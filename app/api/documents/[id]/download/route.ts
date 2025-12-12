import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStorageRoot } from '@/lib/storage';
import { Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) {
    return NextResponse.json({ error: 'Membership required' }, { status: 403 });
  }

  if (![Role.ADMIN, Role.ANALYST, Role.VIEWER].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const document = await prisma.dealDocument.findUnique({
    where: { id: params.id },
    include: { deal: { include: { fund: true } } },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (document.deal.fund.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const storageRoot = path.resolve(getStorageRoot());
  const resolvedPath = path.resolve(document.path);
  if (!resolvedPath.startsWith(storageRoot)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (!fs.existsSync(resolvedPath)) {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolvedPath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.name)}"`,
    },
  });
}
