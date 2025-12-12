import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

export default async function RunsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  const runs = await prisma.analysisRun.findMany({
    where: { executedById: userId },
    include: { deal: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-slate-500">Every analysis run is captured with deterministic rules and evidence.</p>
      </div>
      <div className="card divide-y divide-slate-100">
        {runs.map((run) => (
          <div key={run.id} className="px-5 py-4 text-sm">
            <p className="font-semibold text-slate-900">{run.deal.name}</p>
            <p className="text-slate-600">{run.summary}</p>
            <p className="text-xs text-slate-500">{run.createdAt.toLocaleString()}</p>
          </div>
        ))}
        {runs.length === 0 && <p className="p-5 text-sm text-slate-500">No runs yet.</p>}
      </div>
    </div>
  );
}
