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

async function ensureVectorStore(dealId: string, existing?: string) {
  if (existing) return existing;
  const vectorStore = await openai.vectorStores.create({ name: `deal-${dealId}` });
  await prisma.deal.update({ where: { id: dealId }, data: { openaiVectorStoreId: vectorStore.id } });
  return vectorStore.id;
}

async function pollVectorStoreFile(vectorStoreId: string, fileAssociationId: string) {
  let delay = 1000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await openai.vectorStores.files.retrieve(vectorStoreId, fileAssociationId);
    if (status.status === 'completed') return 'indexed';
    if (status.status === 'failed') return 'failed';
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 10000);
  }
  return 'pending';
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) {
    return NextResponse.json({ error: 'Membership required' }, { status: 403 });
  }

  const allowedRoles: Role[] = [Role.ADMIN, Role.ANALYST];
  if (!allowedRoles.includes(membership.role)) {
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
      const toText = Array.isArray((parsed.to as any)?.value)
        ? ((parsed.to as any).value as any[]).map((addr) => addr?.text || '').filter(Boolean).join(', ')
        : (parsed.to as any)?.text || '';
      const rendered = [
        `Subject: ${parsed.subject || ''}`,
        `From: ${parsed.from?.text || ''}`,
        `To: ${toText}`,
        `Date: ${parsed.date ? parsed.date.toISOString() : ''}`,
        '',
        parsed.text || parsed.html || '',
      ].join('\n');
      uploadPath = path.join(path.dirname(stored.path), `${path.parse(stored.path).name}.txt`);
      fs.writeFileSync(uploadPath, rendered);
    }

    const openaiFile = await openai.files.create({
      file: fs.createReadStream(uploadPath),
      purpose: 'assistants',
    });

    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiFileId: openaiFile.id, openaiStatus: 'uploaded' } });

    const vectorStoreFile = await openai.vectorStores.files.create(vectorStoreId, { file_id: openaiFile.id });
    const openaiStatus = await pollVectorStoreFile(vectorStoreId, vectorStoreFile.id);
    const updated = await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiStatus } });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      mimeType: updated.mimeType,
      openaiStatus,
      dealId: updated.dealId,
      openaiFileId: updated.openaiFileId,
    });
  } catch (error) {
    console.error('OpenAI ingestion failed', error);
    const failedDoc = await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiStatus: 'failed' } });
    return NextResponse.json(
      { id: failedDoc.id, name: failedDoc.name, mimeType: failedDoc.mimeType, openaiStatus: 'failed', error: 'Upload failed' },
      { status: 500 }
    );
  }
}
