import { authOptions } from '@/lib/auth';
import { computeEnergizationConfidence } from '@/lib/analysis';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import RunDetailClient from './client';

export default async function RunDetailPage({ params }: { params: { dealId: string; runId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) return notFound();

  const run = await prisma.analysisRun.findFirst({
    where: {
      id: params.runId,
      dealId: params.dealId,
      deal: { fund: { organizationId: membership.organizationId } },
    },
    include: { evidenceSnippets: true, deal: true },
  });

  if (!run) return notFound();

  const evidence = run.evidence as any;
  const confidence = computeEnergizationConfidence(evidence?.extracted_facts, (run.checklist as any[])?.length || 0);

  return <RunDetailClient run={run} confidence={confidence} />;
}
