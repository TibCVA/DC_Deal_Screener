import { prisma } from '@/lib/prisma';
import { saveLocalFile } from '@/lib/storage';
import { authOptions } from '@/lib/auth';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership) {
    return NextResponse.json({ error: 'Membership required' }, { status: 403 });
  }

  if (![Role.ADMIN, Role.ANALYST].includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient role to upload documents' }, { status: 403 });
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

  const stored = await saveLocalFile(file);
  await prisma.dealDocument.create({ data: { dealId, name: stored.name, path: stored.path, mimeType: stored.mimeType } });
  return NextResponse.json({ ok: true });
}
