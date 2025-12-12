import { prisma } from '@/lib/prisma';
import { deleteStoredFile, saveFile } from '@/lib/storage';
import { authOptions } from '@/lib/auth';
import { openai } from '@/lib/openai';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import { simpleParser } from 'mailparser';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import path from 'path';
import { toFile } from 'openai/uploads';

export const runtime = 'nodejs';

const openaiClient = openai as any;

async function ensureVectorStore(dealId: string, existing?: string) {
  if (existing) return existing;
  const vectorStore = await openaiClient.vectorStores.create({
    name: `deal-${dealId}`,
    expires_after: { anchor: 'last_active_at', days: 30 },
  });
  await prisma.deal.update({ where: { id: dealId }, data: { openaiVectorStoreId: vectorStore.id } });
  return vectorStore.id;
}

async function pollVectorStoreFile(vectorStoreId: string, fileAssociationId: string) {
  let delay = 1000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await openaiClient.vectorStores.files.retrieve(vectorStoreId, fileAssociationId);
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const maxSize = 50 * 1024 * 1024;
  if (buffer.length > maxSize) {
    return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 400 });
  }
  const allowedExts = ['pdf', 'doc', 'docx', 'txt', 'eml'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: pdf, doc, docx, txt, eml.' }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { fund: true } });
  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }
  if (deal.fund.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: 'Forbidden: deal not in your organization' }, { status: 403 });
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const stored = await saveFile(file, buffer);
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

    let ingestBuffer = buffer;
    let ingestName = file.name;
    let ingestMime = file.type || 'application/octet-stream';
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
      ingestBuffer = Buffer.from(rendered);
      ingestName = `${path.parse(file.name).name}.txt`;
      ingestMime = 'text/plain';
    }

    const openaiFile = await openaiClient.files.create({
      file: await toFile(ingestBuffer, ingestName, { type: ingestMime }),
      purpose: 'assistants',
    });

    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiFileId: openaiFile.id, openaiStatus: 'uploaded' } });

    const vectorStoreFile = await openaiClient.vectorStores.files.create(vectorStoreId, { file_id: openaiFile.id });
    const openaiStatus = await pollVectorStoreFile(vectorStoreId, vectorStoreFile.id);
    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiStatus } });

    return NextResponse.json({ id: document.id, openaiStatus });
  } catch (error) {
    console.error('OpenAI ingestion failed', error);
    await prisma.dealDocument.update({ where: { id: document.id }, data: { openaiStatus: 'failed' } });
    await deleteStoredFile(stored.path);
    return NextResponse.json({ id: document.id, openaiStatus: 'failed', error: 'Upload failed' }, { status: 500 });
  }
}
