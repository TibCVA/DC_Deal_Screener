import { prisma } from '@/lib/prisma';
import { saveLocalFile } from '@/lib/storage';
import { authOptions } from '@/lib/auth';
import { openai } from '@/lib/openai';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import { simpleParser } from 'mailparser';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';

const openaiClient = openai as any;

async function ensureVectorStore(dealId: string, existing?: string) {
  if (existing) return existing;
  const vectorStore = await openaiClient.beta.vectorStores.create({ name: `deal-${dealId}` });
  await prisma.deal.update({ where: { id: dealId }, data: { openaiVectorStoreId: vectorStore.id } });
  return vectorStore.id;
}

async function pollVectorStoreFile(vectorStoreId: string, fileAssociationId: string) {
  let delay = 1000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await openaiClient.beta.vectorStores.files.retrieve(vectorStoreId, fileAssociationId);
    if (status.status === 'completed') return 'indexed';
    if (status.status === 'failed') return 'failed';
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 10000);
  }
  return 'pending';
}

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
    return NextResponse.json({ error: 'Insufficient role to upload documents' }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI is not configured' }, { status: 500 });
  }

  const formData = await req.formData();
  const dealId = String(formData.get('dealId'));
  const file = formData.get('file');
  if (!dealId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing dealId or file' }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { fund: true } });
  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }
  if (deal.fund.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: 'Forbidden: deal not in your organization' }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const stored = await saveLocalFile(file, buffer);
  const document = await prisma.dealDocument.create({
    data: {
      dealId,
      name: stored.name,
      path: stored.path,
      mimeType: stored.mimeType,
      sha256,
      originalFileSize: stored.size,
      originalExt: stored.ext,
    },
  });

  try {
    let vectorStoreId = await ensureVectorStore(dealId, deal.openaiVectorStoreId || undefined);

    let uploadPath = stored.path;
    if ((stored.ext || '').toLowerCase() === 'eml') {
      const parsed = await simpleParser(buffer);
      const rendered = [
        `Subject: ${parsed.subject || ''}`,
        `From: ${parsed.from?.text || ''}`,
        `To: ${parsed.to?.text || ''}`,
        `Date: ${parsed.date ? parsed.date.toISOString() : ''}`,
        '',
        parsed.text || parsed.html || '',
      ].join('\n');
      uploadPath = path.join(path.dirname(stored.path), `${path.parse(stored.path).name}.txt`);
      fs.writeFileSync(uploadPath, rendered);
    }

    const openaiFile = await openaiClient.files.create({
      file: fs.createReadStream(uploadPath),
      purpose: 'assistants',
    });

    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiFileId: openaiFile.id, openaiStatus: 'uploaded' } });

    const vectorStoreFile = await openaiClient.beta.vectorStores.files.create(vectorStoreId, { file_id: openaiFile.id });
    const openaiStatus = await pollVectorStoreFile(vectorStoreId, vectorStoreFile.id);
    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiStatus } });

    return NextResponse.json({ id: document.id, openaiStatus });
  } catch (error) {
    console.error('OpenAI ingestion failed', error);
    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiStatus: 'failed' } });
    return NextResponse.json({ id: document.id, openaiStatus: 'failed', error: 'Upload failed' }, { status: 500 });
  }
}
