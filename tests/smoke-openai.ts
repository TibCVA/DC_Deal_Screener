import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/openai';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { toFile } from 'openai/uploads';
import { runDeterministicAnalysis } from '@/lib/analysis';
import { hash } from 'bcryptjs';

async function pollFile(vectorStoreId: string, fileId: string) {
  let delay = 1000;
  for (let i = 0; i < 6; i++) {
    const status = await (openai as any).vectorStores.files.retrieve(vectorStoreId, fileId);
    if (status.status === 'completed') return;
    if (status.status === 'failed') throw new Error('Vector store indexing failed');
    await new Promise((res) => setTimeout(res, delay));
    delay *= 2;
  }
}

async function main() {
  if (process.env.RUN_INTEGRATION_TESTS !== '1' || !process.env.OPENAI_API_KEY) {
    console.log('Skipping smoke test: RUN_INTEGRATION_TESTS!=1 or OPENAI_API_KEY missing');
    return;
  }

  const orgId = randomUUID();
  const userId = randomUUID();
  const fundId = randomUUID();
  const dealId = randomUUID();

  const organization = await prisma.organization.create({ data: { id: orgId, name: 'Smoke Org' } });
  const passwordHash = await hash('temporary-password', 10);
  const user = await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: 'Smoke Admin', passwordHash } });
  await prisma.membership.create({ data: { organizationId: organization.id, userId: user.id, role: 'ADMIN' } });
  const fund = await prisma.fund.create({ data: { id: fundId, name: 'Smoke Fund', organizationId: organization.id, thesis: {} } });

  const vectorStore = await (openai as any).vectorStores.create({ name: `smoke-${dealId}` });

  const fixturePath = path.join(process.cwd(), 'fixtures/connection_letter.txt');
  const fixtureBuffer = fs.readFileSync(fixturePath);
  const openaiFile = await (openai as any).files.create({ file: await toFile(fixtureBuffer, 'connection_letter.txt', { type: 'text/plain' }), purpose: 'assistants' });
  const vectorStoreFile = await (openai as any).vectorStores.files.create(vectorStore.id, { file_id: openaiFile.id });
  await pollFile(vectorStore.id, vectorStoreFile.id);

  await prisma.deal.create({
    data: {
      id: dealId,
      name: 'Smoke Deal',
      country: 'US',
      city: 'Test',
      productType: 'Test',
      type: 'GREENFIELD',
      fundId: fund.id,
      openaiVectorStoreId: vectorStore.id,
      documents: {
        create: {
          name: 'connection_letter.txt',
          path: 'spaces:fixture',
          mimeType: 'text/plain',
          openaiFileId: openaiFile.id,
          openaiStatus: 'uploaded',
        },
      },
    },
  });

  const run = await runDeterministicAnalysis({ dealId, userId: user.id, organizationId: organization.id, includeMarketResearch: false });
  const snippets = (run?.evidenceSnippets || []).filter((s) => s.text);
  if (!snippets.length) {
    throw new Error('Smoke test failed: no snippets returned');
  }
  const checklist = Array.isArray(run?.checklist) ? (run as any).checklist : [];
  const hasCitations = snippets.some((s) => typeof s.score === 'number');
  if (!hasCitations) {
    throw new Error('Smoke test failed: missing citations');
  }
  console.log('Smoke test passed');

  await prisma.analysisEvidenceSnippet.deleteMany({ where: { analysisRunId: run?.id } });
  if (run?.id) await prisma.analysisRun.delete({ where: { id: run.id } });
  await prisma.dealDocument.deleteMany({ where: { dealId } });
  await prisma.deal.delete({ where: { id: dealId } });
  await prisma.fund.delete({ where: { id: fund.id } });
  await prisma.membership.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await (openai as any).vectorStores.del(vectorStore.id).catch(() => {});
  await (openai as any).files.del(openaiFile.id).catch(() => {});
}

main().finally(async () => {
  await prisma.$disconnect();
});
