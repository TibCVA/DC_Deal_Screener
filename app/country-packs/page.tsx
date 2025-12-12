import { authOptions } from '@/lib/auth';
import { sanitizeAllowedDomainsInput } from '@/lib/allowedDomains';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { Role } from '@prisma/client';
import AllowedDomainsField from '@/components/AllowedDomainsField';

async function saveCountryPack(formData: FormData, packId: string) {
  'use server';
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership || membership.role !== Role.ADMIN) throw new Error('Forbidden');
  const pack = await prisma.countryPack.findFirst({ where: { id: packId, organizationId: membership.organizationId } });
  if (!pack) throw new Error('Forbidden');
  const { sanitized, invalid, tooMany } = sanitizeAllowedDomainsInput(String(formData.get('allowedDomains') || ''));
  if (tooMany) {
    throw new Error('You can only specify up to 100 allowed domains.');
  }
  if (invalid.length > 0) {
    throw new Error(`Invalid domain entries: ${invalid.join(', ')}`);
  }
  const goldSources = String(formData.get('goldSources'));
  const artefacts = String(formData.get('artefacts'));
  await prisma.countryPack.update({
    where: { id: packId },
    data: {
      allowedDomains: sanitized,
      goldSources: { description: goldSources },
      artefacts: { description: artefacts },
    },
  });
  revalidatePath('/country-packs');
}

export default async function CountryPacksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findFirst({ where: { userId: (session.user as any).id } });
  if (!membership) return null;
  if (membership.role !== Role.ADMIN) {
    return <div className="rounded-xl bg-white p-6 shadow">Only admins can edit country packs.</div>;
  }
  const packs = await prisma.countryPack.findMany({ where: { organizationId: membership.organizationId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Country packs</h1>
        <p className="text-sm text-slate-500">Control official sources, artefact definitions, and scoring overrides per market.</p>
      </div>
      {packs.map((pack) => (
        <form key={pack.id} action={(formData) => saveCountryPack(formData, pack.id)} className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Country</p>
              <h2 className="text-xl font-semibold">{pack.name} ({pack.countryCode})</h2>
            </div>
            <button type="submit" className="btn-primary">Save</button>
          </div>
          <div className="space-y-3">
            <AllowedDomainsField defaultValue={pack.allowedDomains.join('\n')} />
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Gold sources</label>
              <textarea name="goldSources" defaultValue={(pack.goldSources as any)?.description || ''} className="w-full" rows={3}></textarea>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Artefact definitions</label>
              <textarea name="artefacts" defaultValue={(pack.artefacts as any)?.description || ''} className="w-full" rows={3}></textarea>
            </div>
          </div>
        </form>
      ))}
    </div>
  );
}
