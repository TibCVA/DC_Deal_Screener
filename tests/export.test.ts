import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getServerSession } from 'next-auth';
import { AuthorizationError, buildIcPackPdfBuffer } from '@/lib/export/icPack';
import { GET } from '../app/api/deals/[dealId]/runs/[runId]/export/pdf/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/export/icPack', () => {
  class MockAuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    AuthorizationError: MockAuthError,
    buildIcPackPdfBuffer: vi.fn(),
  };
});
vi.mock('@/lib/prisma', () => ({ prisma: { deal: { findUnique: vi.fn().mockResolvedValue({ name: 'Demo Deal' }) } } }));

describe('IC pack export route', () => {
  const mockSession = { user: { id: 'user-1' } } as any;

  beforeEach(() => {
    (getServerSession as any).mockReset();
    (buildIcPackPdfBuffer as any).mockReset();
  });

  it('returns pdf for authorized member', async () => {
    (getServerSession as any).mockResolvedValue(mockSession);
    (buildIcPackPdfBuffer as any).mockResolvedValue(Buffer.from('pdf-bytes'));

    const res = await GET(new Request('http://localhost/api/deals/d1/runs/r1/export/pdf'), {
      params: { dealId: 'd1', runId: 'r1' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as any).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/deals/d1/runs/r1/export/pdf'), {
      params: { dealId: 'd1', runId: 'r1' },
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is forbidden', async () => {
    (getServerSession as any).mockResolvedValue(mockSession);
    (buildIcPackPdfBuffer as any).mockRejectedValue(new (AuthorizationError as any)('Forbidden', 403));

    const res = await GET(new Request('http://localhost/api/deals/d1/runs/r1/export/pdf'), {
      params: { dealId: 'd1', runId: 'r1' },
    });

    expect(res.status).toBe(403);
  });
});
