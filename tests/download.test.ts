import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'path';
import { GET } from '../app/api/documents/[id]/download/route';

const mockGetServerSession = vi.hoisted(() => vi.fn());
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockMembershipFind = vi.hoisted(() => vi.fn());
const mockDocumentFind = vi.hoisted(() => vi.fn());
vi.mock('../lib/prisma', () => ({
  prisma: {
    membership: { findFirst: mockMembershipFind },
    dealDocument: { findUnique: mockDocumentFind },
  },
}));

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}));

vi.mock('../lib/storage', () => ({ getStorageRoot: () => path.resolve('/workspace/uploads') }));

describe('document download route', () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
    mockMembershipFind.mockReset();
    mockDocumentFind.mockReset();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('rejects unauthorized requests', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), { params: { id: 'doc1' } });
    expect(res.status).toBe(401);
  });

  it('blocks cross-organization access', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user1' } });
    mockMembershipFind.mockResolvedValue({ id: 'm1', role: 'VIEWER', organizationId: 'org1' });
    mockDocumentFind.mockResolvedValue({ id: 'doc1', path: '/workspace/uploads/doc1.pdf', mimeType: 'application/pdf', name: 'doc.pdf', deal: { fund: { organizationId: 'org2' } } });
    const res = await GET(new Request('http://localhost'), { params: { id: 'doc1' } });
    expect(res.status).toBe(403);
  });

  it('allows authorized download', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user1' } });
    mockMembershipFind.mockResolvedValue({ id: 'm1', role: 'ANALYST', organizationId: 'org1' });
    mockDocumentFind.mockResolvedValue({ id: 'doc1', path: '/workspace/uploads/doc1.pdf', mimeType: 'application/pdf', name: 'doc.pdf', deal: { fund: { organizationId: 'org1' } } });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from('filedata'));
    const res = await GET(new Request('http://localhost'), { params: { id: 'doc1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });
});
