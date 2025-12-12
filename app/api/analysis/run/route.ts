import { runDeterministicAnalysis } from '@/lib/analysis';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership) {
    return NextResponse.json({ error: 'Membership required' }, { status: 403 });
  }

  const privilegedRoles: Role[] = [Role.ADMIN, Role.ANALYST];
  if (!privilegedRoles.includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient role to run analysis' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const dealId = body?.dealId as string | undefined;
  const includeMarketResearch = Boolean(body?.includeMarketResearch);
  if (!dealId) {
    return NextResponse.json({ error: 'Missing dealId' }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { fund: true } });
  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.fund.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: 'Forbidden: deal not in your organization' }, { status: 403 });
  }

  try {
    const run = await runDeterministicAnalysis({
      dealId,
      userId: (session.user as any).id,
      organizationId: membership.organizationId,
      includeMarketResearch,
    });
    return NextResponse.json(run);
  } catch (err: any) {
    return NextResponse.json({ error: 'Analysis failed', detail: err.message }, { status: 500 });
  }
}
