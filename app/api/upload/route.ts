import { prisma } from '@/lib/prisma';
import { saveLocalFile } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const formData = await req.formData();
  const dealId = String(formData.get('dealId'));
  const file = formData.get('file');
  if (!dealId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing dealId or file' }, { status: 400 });
  }
  const stored = await saveLocalFile(file);
  await prisma.dealDocument.create({ data: { dealId, name: stored.name, path: stored.path, mimeType: stored.mimeType } });
  return NextResponse.json({ ok: true });
}
