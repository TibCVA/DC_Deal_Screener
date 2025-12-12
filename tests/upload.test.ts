import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import fs from 'fs';

process.env.OPENAI_API_KEY = 'test-key';

const { membershipFixture } = vi.hoisted(() => ({
  membershipFixture: { id: 'm1', userId: 'user1', organizationId: 'org1', role: 'ADMIN' } as any,
}));

const { mockDealUpdate, mockDealFindUnique, mockDealDocumentCreate, mockDealDocumentUpdate } = vi.hoisted(() => ({
  mockDealUpdate: vi.fn(),
  mockDealFindUnique: vi.fn(),
  mockDealDocumentCreate: vi.fn(),
  mockDealDocumentUpdate: vi.fn(),
}));

vi.mock('mailparser', () => ({
  simpleParser: vi.fn().mockResolvedValue({ text: '', attachments: [] }),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user1' } }),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

vi.mock('@prisma/client', () => ({
  Role: { ADMIN: 'ADMIN', ANALYST: 'ANALYST', VIEWER: 'VIEWER' },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    membership: { findFirst: vi.fn().mockResolvedValue(membershipFixture) },
    deal: {
      findUnique: (...args: any[]) => mockDealFindUnique(...args),
      update: (...args: any[]) => mockDealUpdate(...args),
    },
    dealDocument: {
      create: (...args: any[]) => mockDealDocumentCreate(...args),
      update: (...args: any[]) => mockDealDocumentUpdate(...args),
    },
  },
}));

const { mockRetrieve, mockVectorStoreCreate, mockVectorStoreFileCreate, mockFilesCreate } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockVectorStoreCreate: vi.fn(),
  mockVectorStoreFileCreate: vi.fn(),
  mockFilesCreate: vi.fn(),
}));

vi.mock('@/lib/openai', () => ({
  openai: {
    files: {
      create: mockFilesCreate,
    },
    vectorStores: {
      create: (...args: any[]) => mockVectorStoreCreate(...args),
      files: {
        create: (...args: any[]) => mockVectorStoreFileCreate(...args),
        retrieve: (...args: any[]) => mockRetrieve(...args),
      },
    },
  },
}));

import { POST } from '../app/api/upload/route';

function buildRequest(fileName: string, content: string, mime = 'text/plain') {
  const formData = new FormData();
  const file = new File([content], fileName, { type: mime });
  formData.append('file', file);
  formData.append('dealId', 'deal1');
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData });
}

beforeEach(() => {
  mockDealUpdate.mockReset();
  mockDealFindUnique.mockReset();
  mockDealDocumentCreate.mockReset();
  mockDealDocumentUpdate.mockReset();
  mockFilesCreate.mockReset();
  mockRetrieve.mockReset();
  mockVectorStoreCreate.mockReset();
  mockVectorStoreFileCreate.mockReset();

  mockFilesCreate.mockResolvedValue({ id: 'file-123' });

  mockDealDocumentCreate.mockResolvedValue({
    id: 'doc-1',
    name: 'note.txt',
    path: path.join(process.cwd(), 'uploads', 'note.txt'),
  });

  mockDealFindUnique.mockResolvedValue({
    id: 'deal1',
    openaiVectorStoreId: null,
    fund: { organizationId: 'org1' },
  });

  mockVectorStoreCreate.mockResolvedValue({ id: 'vs-1' });
  mockVectorStoreFileCreate.mockResolvedValue({ id: 'vs-file-1' });
  mockRetrieve.mockResolvedValue({ status: 'completed' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('upload api', () => {
  it('creates a vector store and indexes a file', async () => {
    const req = buildRequest('note.txt', 'hello world');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiStatus).toBe('indexed');
    expect(mockVectorStoreCreate).toHaveBeenCalled();
    expect(mockVectorStoreFileCreate).toHaveBeenCalledWith('vs-1', { file_id: 'file-123' });
    expect(mockDealDocumentUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ openaiStatus: 'indexed' }) }));
  });

  it('reuses an existing vector store and converts eml to text', async () => {
    const emlBody = `From: sender@example.com\nTo: receiver@example.com\nSubject: Test email\nDate: Tue, 21 May 2024 10:00:00 +0000\n\nHello body`;
    mockDealFindUnique.mockResolvedValueOnce({ id: 'deal1', openaiVectorStoreId: 'vs-existing', fund: { organizationId: 'org1' } });
    const req = buildRequest('message.eml', emlBody, 'message/rfc822');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiStatus).toBe('indexed');
    expect(mockVectorStoreCreate).not.toHaveBeenCalled();
    const createCall = (mockVectorStoreFileCreate.mock.calls[0][1] as any).file_id;
    expect(createCall).toBe('file-123');
  });
});
