import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileStream } from '@/lib/storage';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership) {
    return NextResponse.json({ error: 'Membership required' }, { status: 403 });
  }

  const document = await prisma.dealDocument.findUnique({
    where: { id: params.id },
    include: { deal: { include: { fund: true } } },
  });

  if (!document || document.deal.fund.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { stream, contentType } = await getFileStream(document.path);
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType || document.mimeType,
        'Content-Disposition': `attachment; filename="${document.name}"`,
      },
    });
  } catch (err) {
    console.error('Download failed', err);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
