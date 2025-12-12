import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { Role } from '@prisma/client';

async function saveThesis(formData: FormData, fundId: string) {
  'use server';
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership || membership.role !== Role.ADMIN) throw new Error('Forbidden');
  const fund = await prisma.fund.findFirst({ where: { id: fundId, organizationId: membership.organizationId } });
  if (!fund) throw new Error('Forbidden');
  const thesis = {
    markets: String(formData.get('markets')),
    productFocus: String(formData.get('productFocus')),
    dealTypes: String(formData.get('dealTypes')),
    riskAppetite: String(formData.get('riskAppetite')),
    esg: String(formData.get('esg')),
    evidenceLevel: String(formData.get('evidenceLevel')),
  };
  await prisma.fund.update({ where: { id: fundId }, data: { thesis } });
  revalidatePath('/funds');
}

export default async function FundsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership) return null;
  if (membership.role !== Role.ADMIN) {
    return <div className="rounded-xl bg-white p-6 shadow">Only admins can edit fund onboarding.</div>;
  }
  const funds = await prisma.fund.findMany({ where: { organizationId: membership.organizationId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fund onboarding</h1>
        <p className="text-sm text-slate-500">Capture thesis and risk appetite. These settings drive scoring rules.</p>
      </div>
      {funds.map((fund) => (
        <form key={fund.id} action={(formData) => saveThesis(formData, fund.id)} className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Fund</p>
              <h2 className="text-xl font-semibold">{fund.name}</h2>
            </div>
            <button type="submit" className="btn-primary">Save</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Markets</label>
              <input name="markets" defaultValue={(fund.thesis as any)?.markets || ''} className="w-full" placeholder="FR, UK, NL" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Product focus</label>
              <input name="productFocus" defaultValue={(fund.thesis as any)?.productFocus || ''} className="w-full" placeholder="Hyperscale, Edge" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Deal types</label>
              <input name="dealTypes" defaultValue={(fund.thesis as any)?.dealTypes || ''} className="w-full" placeholder="Greenfield, Brownfield" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Risk appetite</label>
              <input name="riskAppetite" defaultValue={(fund.thesis as any)?.riskAppetite || ''} className="w-full" placeholder="Firm power only, flex tolerated" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">ESG/Sovereignty constraints</label>
              <input name="esg" defaultValue={(fund.thesis as any)?.esg || ''} className="w-full" placeholder="No coal adjacency, EU data residency" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Required evidence level</label>
              <input name="evidenceLevel" defaultValue={(fund.thesis as any)?.evidenceLevel || ''} className="w-full" placeholder="Signed permits, official grid letters" />
            </div>
          </div>
        </form>
      ))}
    </div>
  );
}
