import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import Link from 'next/link';

export default async function DealsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) return null;
  const deals = await prisma.deal.findMany({ where: { fund: { organizationId: membership.organizationId } }, include: { fund: true } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deals</h1>
          <p className="text-sm text-slate-500">All active opportunities in your fund.</p>
        </div>
        {([Role.ADMIN, Role.ANALYST] as Role[]).includes(membership.role) && (
          <Link href="/deals/new" className="btn-primary">New deal</Link>
        )}
      </div>
      <div className="card divide-y divide-slate-100">
        {deals.map((deal) => (
          <div key={deal.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-semibold text-slate-900">{deal.name}</p>
              <p className="text-sm text-slate-500">{deal.city}, {deal.country} • {deal.productType} • {deal.type}</p>
              <p className="text-xs text-slate-500">Fund: {deal.fund.name}</p>
            </div>
            <Link href={`/deals/${deal.id}`} className="text-brand text-sm">Open</Link>
          </div>
        ))}
        {deals.length === 0 && <p className="p-5 text-sm text-slate-500">No deals yet.</p>}
      </div>
    </div>
  );
}
