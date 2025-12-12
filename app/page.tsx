import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import Link from 'next/link';

async function getDashboardData(userId: string) {
  const membership = await prisma.membership.findFirst({ where: { userId }, include: { organization: true } });
  if (!membership) return null;
  const funds = await prisma.fund.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      deals: {
        include: {
          analyses: true,
          documents: true,
        },
      },
    },
  });
  const countryPacks = await prisma.countryPack.findMany({ where: { organizationId: membership.organizationId } });
  return { membership, funds, countryPacks };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return <div className="rounded-xl bg-white p-6 shadow">You must be signed in.</div>;
  }
  const data = await getDashboardData(userId);
  if (!data) return <div className="rounded-xl bg-white p-6 shadow">No organization found.</div>;
  const { funds, membership, countryPacks } = data;
  const totalDeals = funds.reduce((acc, f) => acc + f.deals.length, 0);
  const lastAnalysis = funds.flatMap(f => f.deals.flatMap(d => d.analyses)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-brand/10 via-white to-slate-50 p-6 shadow-sm border border-brand/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-brand-dark font-semibold">Welcome, {session.user?.name}</p>
            <h1 className="text-3xl font-bold text-slate-900">DC Deal Screener</h1>
            <p className="max-w-2xl text-slate-600">Evidence-first underwriting workspace aligned to your fund thesis and country packs.</p>
          </div>
          {([Role.ADMIN, Role.ANALYST] as Role[]).includes(membership.role) && (
            <Link href="/deals/new" className="btn-primary">New deal</Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Funds</p>
            <p className="text-2xl font-semibold">{funds.length}</p>
            <p className="text-xs text-slate-500">Organization: {membership.organization.name}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Deals</p>
            <p className="text-2xl font-semibold">{totalDeals}</p>
            <p className="text-xs text-slate-500">Across all active mandates</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Country packs</p>
            <p className="text-2xl font-semibold">{countryPacks.length}</p>
            <p className="text-xs text-slate-500">With gold sources + queue rules</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active deals</h2>
            <Link href="/deals" className="text-sm text-brand">View all</Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {funds.flatMap(f => f.deals).map(deal => (
              <div key={deal.id} className="py-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{deal.name}</p>
                  <p className="text-sm text-slate-500">{deal.city}, {deal.country} • {deal.productType} • {deal.type}</p>
                  <p className="text-xs text-slate-500">Documents: {deal.documents.length} | Runs: {deal.analyses.length}</p>
                </div>
                <Link href={`/deals/${deal.id}`} className="text-sm text-brand">Open</Link>
              </div>
            ))}
            {funds.every(f => f.deals.length === 0) && (
              <p className="py-4 text-sm text-slate-500">No deals yet. Start with a new deal.</p>
            )}
          </div>
        </div>
        <div className="card p-5 space-y-3">
          <h2 className="text-lg font-semibold">Recent analysis</h2>
          {lastAnalysis ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>Deal: {lastAnalysis.dealId}</p>
              <p>Summary: {lastAnalysis.summary}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No analyses yet.</p>
          )}
          <Link href="/analysis/runs" className="text-sm text-brand">Audit log</Link>
        </div>
      </div>
    </div>
  );
}
