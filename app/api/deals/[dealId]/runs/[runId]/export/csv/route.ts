import { authOptions } from '@/lib/auth';
import { buildUnderwritingTape } from '@/lib/export/underwritingTape';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Export analysis run as CSV (Underwriting Tape format)
 * GET /api/deals/[dealId]/runs/[runId]/export/csv
 */
export async function GET(
  req: Request,
  { params }: { params: { dealId: string; runId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  // Verify membership
  const membership = await prisma.membership.findFirst({
    where: { userId },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Membership required' }, { status: 403 });
  }

  // Fetch deal to verify organization access
  const deal = await prisma.deal.findUnique({
    where: { id: params.dealId },
    include: { fund: true },
  });

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.fund.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch analysis run
  const run = await prisma.analysisRun.findUnique({
    where: { id: params.runId },
  });

  if (!run) {
    return NextResponse.json({ error: 'Analysis run not found' }, { status: 404 });
  }

  if (run.dealId !== deal.id) {
    return NextResponse.json({ error: 'Run does not belong to this deal' }, { status: 403 });
  }

  try {
    // Build underwriting tape
    const { csv, rows } = await buildUnderwritingTape(params.runId);

    // Get format preference from query string
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'full';

    let content: string;
    let filename: string;

    if (format === 'summary') {
      // Generate summary CSV (one row per deal, critical variables only)
      const { toSummaryCSV } = await import('@/lib/export/underwritingTape');
      content = toSummaryCSV(rows);
      filename = `Underwriting-Summary_${deal.name.replace(/[^a-zA-Z0-9]/g, '_')}_${params.runId.slice(0, 8)}.csv`;
    } else {
      // Full detailed CSV
      content = csv;
      filename = `Underwriting-Tape_${deal.name.replace(/[^a-zA-Z0-9]/g, '_')}_${params.runId.slice(0, 8)}.csv`;
    }

    // Return CSV with proper headers
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('CSV export failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}
