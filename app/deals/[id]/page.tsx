import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import DealWorkspace from './workspace';

export default async function DealPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership) return notFound();
  const deal = await prisma.deal.findFirst({
    where: { id: params.id, fund: { organizationId: membership.organizationId } },
    include: { documents: true, analyses: { orderBy: { createdAt: 'desc' } }, fund: true },
  });
  if (!deal) return notFound();
  return <DealWorkspace deal={deal} role={membership.role} />;
}
