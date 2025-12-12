import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

export default async function RunsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const runs = await prisma.analysisRun.findMany({
    where: { executedById: (session.user as any).id },
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
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2 py-1 font-semibold ${run.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {run.status === 'FAILED' ? 'Failed' : 'Success'}
              </span>
              {run.modelUsed && <span>Model: {run.modelUsed}</span>}
              <span>{run.createdAt.toLocaleString()}</span>
            </div>
            {run.errorMessage && <p className="text-xs text-rose-600">Error: {run.errorMessage}</p>}
          </div>
        ))}
        {runs.length === 0 && <p className="p-5 text-sm text-slate-500">No runs yet.</p>}
      </div>
    </div>
  );
}
