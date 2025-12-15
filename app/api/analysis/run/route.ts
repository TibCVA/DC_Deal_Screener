import { runDeterministicAnalysis } from '@/lib/analysis';
import { runAnalysisPipelineV1 } from '@/lib/analysis-pipeline-v1';
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
  const includeMarketContext = Boolean(body?.includeMarketContext ?? body?.includeMarketResearch);
  const useV1Pipeline = body?.useV1 !== false; // Default to V1, can opt-out with useV1: false

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
    if (useV1Pipeline) {
      // DD Contract V1 Pipeline - Full ontology with hard gates, module scores, energisation
      const ddContract = await runAnalysisPipelineV1({
        dealId,
        userId: (session.user as any).id,
        organizationId: membership.organizationId,
        includeMarketContext,
      });

      return NextResponse.json({
        success: true,
        contract_version: ddContract.contract_version,
        run_id: ddContract.run_meta.deal_id,
        hard_gate_decision: ddContract.scoring.hard_gate_result.decision,
        overall_score: ddContract.scoring.overall.score_0_100,
        executive_summary: ddContract.scoring.overall.executive_summary,
        module_scores: ddContract.scoring.module_scorecard,
        energisation_24m: ddContract.scoring.energisation.curve.find((c) => c.horizon_months === 24)?.p,
        checklist_count: ddContract.checklist.length,
        contradictions_count: ddContract.deal_evidence.contradictions.length,
        // Full contract available for detailed views
        dd_contract: ddContract,
      });
    } else {
      // Legacy V0 Pipeline - Basic deterministic analysis
      const run = await runDeterministicAnalysis({
        dealId,
        userId: (session.user as any).id,
        organizationId: membership.organizationId,
        includeMarketResearch,
      });
      return NextResponse.json(run);
    }
  } catch (err: any) {
    console.error('Analysis pipeline error:', err);

    // Create a FAILED run record for audit trail
    try {
      await prisma.analysisRun.create({
        data: {
          dealId,
          executedById: (session.user as any).id,
          evidence: {},
          scorecard: [],
          summary: 'Analysis failed',
          checklist: [],
          status: 'FAILED',
          errorMessage: err.message || 'Unknown error',
          modelUsed: process.env.OPENAI_MODEL || 'gpt-4o',
        },
      });
    } catch {
      // Ignore if we can't create the failed run record
    }

    return NextResponse.json(
      {
        error: 'Analysis failed',
        detail: err.message,
        suggestion: 'Check that documents are indexed and OpenAI API is accessible',
      },
      { status: 500 }
    );
  }
}
