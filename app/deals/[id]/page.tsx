import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import DealWorkspace from './workspace';

export default async function DealPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: { documents: true, analyses: { orderBy: { createdAt: 'desc' } }, fund: true },
  });
  if (!deal) return notFound();
  return <DealWorkspace deal={deal} userId={(session.user as any).id} />;
}
