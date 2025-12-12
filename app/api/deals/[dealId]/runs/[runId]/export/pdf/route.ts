import { AuthorizationError, buildIcPackPdfBuffer } from '@/lib/export/icPack';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { dealId: string; runId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const buffer = await buildIcPackPdfBuffer({
      dealId: params.dealId,
      runId: params.runId,
      userId: (session.user as any).id,
    });

    const deal = await prisma.deal.findUnique({ where: { id: params.dealId }, select: { name: true } });
    const dealName = deal?.name?.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'deal';
    const fileName = `IC-Pack_${dealName}_${params.runId}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      const status = err.statusCode === 401 ? 401 : 403;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to build IC pack', detail: err?.message }, { status: 500 });
  }
}
