import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteStoredFile } from '@/lib/storage';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership || membership.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const deal = await prisma.deal.findFirst({
    where: { id: params.id, fund: { organizationId: membership.organizationId } },
    include: { documents: true, analyses: true },
  });
  if (!deal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  for (const doc of deal.documents) {
    await deleteStoredFile(doc.path);
    if (doc.openaiFileId) {
      await openai.files.del(doc.openaiFileId).catch(() => {});
    }
    if (deal.openaiVectorStoreId && doc.openaiFileId) {
      await (openai as any).vectorStores.files.del(deal.openaiVectorStoreId, doc.openaiFileId).catch(() => {});
    }
  }

  if (deal.openaiVectorStoreId) {
    await (openai as any).vectorStores.del(deal.openaiVectorStoreId).catch(() => {});
  }

  const runIds = deal.analyses.map((a) => a.id);
  if (runIds.length > 0) {
    await prisma.analysisEvidenceSnippet.deleteMany({ where: { analysisRunId: { in: runIds } } });
    await prisma.analysisRun.deleteMany({ where: { id: { in: runIds } } });
  }

  const docIds = deal.documents.map((d) => d.id);
  if (docIds.length > 0) {
    await prisma.dealDocument.deleteMany({ where: { id: { in: docIds } } });
  }

  await prisma.deal.delete({ where: { id: deal.id } });

  return NextResponse.json({ status: 'deleted' });
}
