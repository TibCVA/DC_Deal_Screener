import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DealType, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

async function createDeal(formData: FormData) {
  'use server';
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) throw new Error('Unauthorized');
  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) throw new Error('Not authorized');
  if (membership.role === Role.VIEWER) throw new Error('Insufficient role');
  const fundId = String(formData.get('fundId'));
  const fund = await prisma.fund.findFirst({ where: { id: fundId, organizationId: membership.organizationId } });
  if (!fund) throw new Error('Forbidden');
  const name = String(formData.get('name'));
  const country = String(formData.get('country'));
  const city = String(formData.get('city'));
  const productType = String(formData.get('productType'));
  const type = String(formData.get('type')) as DealType;
  await prisma.deal.create({ data: { name, country, city, productType, type, fundId } });
  revalidatePath('/deals');
  redirect('/deals');
}

export default async function NewDealPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) return null;
  const funds = await prisma.fund.findMany({ where: { organizationId: membership.organizationId } });

  if (membership.role === Role.VIEWER) {
    return <div className="rounded-xl bg-white p-6 shadow">You do not have permission to create deals.</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create deal</h1>
        <p className="text-sm text-slate-500">Capture the basics to start screening.</p>
      </div>
      <form action={createDeal} className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Fund</label>
            <select name="fundId" required className="w-full">
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>{fund.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Deal name</label>
            <input name="name" required className="w-full" placeholder="Example DC" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Country</label>
            <input name="country" required className="w-full" placeholder="FR" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">City</label>
            <input name="city" required className="w-full" placeholder="Paris" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Product type</label>
            <input name="productType" required className="w-full" placeholder="Hyperscale" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Deal type</label>
            <select name="type" required className="w-full">
              <option value={DealType.GREENFIELD}>Greenfield</option>
              <option value={DealType.BROWNFIELD}>Brownfield</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary">Save</button>
      </form>
    </div>
  );
}
