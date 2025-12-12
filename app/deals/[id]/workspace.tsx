'use client';

import { AnalysisEvidenceSnippet, AnalysisRun, AnalysisRunStatus, Deal, DealDocument, Role } from '@prisma/client';
import { useMemo, useState, useTransition } from 'react';

type AnalysisWithEvidence =
  Omit<AnalysisRun, 'status' | 'errorMessage' | 'modelUsed'> & {
    status: AnalysisRunStatus;
    errorMessage: string | null;
    modelUsed: string | null;
    evidenceSnippets: AnalysisEvidenceSnippet[];
  };

export default function DealWorkspace({ deal, role }: { deal: Deal & { documents: DealDocument[]; analyses: AnalysisWithEvidence[] }; role: Role; }) {
  const [analyses, setAnalyses] = useState<AnalysisWithEvidence[]>(deal.analyses);
  const [activeRunId, setActiveRunId] = useState<string | null>(deal.analyses[0]?.id || null);
  const [uploading, setUploading] = useState(false);
  const [running, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [binderTab, setBinderTab] = useState<'uploads' | 'evidence'>('uploads');
  const [selectedSnippet, setSelectedSnippet] = useState<AnalysisEvidenceSnippet | null>(null);
  const [includeMarketResearch, setIncludeMarketResearch] = useState(false);
  const canEdit = role === Role.ADMIN || role === Role.ANALYST;

  function renderStatusBadge(status?: string) {
    const normalized = (status || 'pending').toLowerCase();
    const label = normalized === 'indexed' ? 'Indexed' : normalized === 'failed' ? 'Failed' : normalized === 'uploaded' ? 'Uploading' : 'Pending';
    const color =
      normalized === 'indexed'
        ? 'bg-green-100 text-green-700'
        : normalized === 'failed'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-amber-100 text-amber-700';
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{label}</span>;
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) {
      setMessage('You do not have permission to upload documents.');
      return;
    }
    const formData = new FormData(e.currentTarget);
    formData.append('dealId', deal.id);
    setUploading(true);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    setUploading(false);
    if (res.ok) {
      setMessage('File uploaded. Refresh to see it listed.');
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error || 'Upload failed');
    }
  }

  async function runAnalysis() {
    if (!canEdit) {
      setMessage('You do not have permission to run analysis.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, includeMarketResearch }),
      });
      if (res.ok) {
        const data = (await res.json()) as AnalysisWithEvidence;
        setAnalyses((prev) => [data, ...prev]);
        setActiveRunId(data.id);
        setMessage('Analysis completed');
      } else {
        const body = await res.json().catch(() => ({}));
        setMessage(body.error || 'Analysis failed');
      }
    });
  }

  const activeRun = useMemo(() => analyses.find((a) => a.id === activeRunId) || analyses[0], [analyses, activeRunId]);
  const snippetMap = useMemo(() => {
    if (!activeRun) return {} as Record<string, AnalysisEvidenceSnippet>;
    return Object.fromEntries(activeRun.evidenceSnippets.map((s) => [s.snippetId, s]));
  }, [activeRun]);

  const marketResearch = (activeRun as any)?.marketResearch as
    | { summary?: string; citations?: string[]; sources?: string[] }
    | undefined;

  function renderRunStatus(status?: string) {
    const normalized = (status || 'SUCCESS').toLowerCase();
    const color = normalized === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700';
    const label = normalized === 'failed' ? 'Failed' : 'Success';
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{label}</span>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{deal.country} • {deal.city} • {deal.type}</p>
          <h1 className="text-2xl font-semibold">{deal.name}</h1>
          <p className="text-sm text-slate-500">{deal.productType}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeMarketResearch}
              onChange={(e) => setIncludeMarketResearch(e.target.checked)}
              disabled={!canEdit || running}
            />
            Include official market research
          </label>
          <button onClick={runAnalysis} className="btn-primary" disabled={running || !canEdit}>
            {running ? 'Running…' : 'Run analysis'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Evidence binder</h2>
              <p className="text-sm text-slate-500">Upload dataroom docs, then review the snippets cited by the model.</p>
            </div>
            <div className="flex gap-2">
              <button
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${binderTab === 'uploads' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() => setBinderTab('uploads')}
              >
                Uploads
              </button>
              <button
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${binderTab === 'evidence' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() => setBinderTab('evidence')}
              >
                Analysis evidence
              </button>
            </div>
          </div>

          {binderTab === 'uploads' && (
            <div>
              {canEdit ? (
                <form onSubmit={handleUpload} className="mt-1 flex items-center gap-3" encType="multipart/form-data">
                  <input type="file" name="file" className="flex-1" required />
                  <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
                </form>
              ) : (
                <p className="mt-1 text-sm text-slate-500">View-only access. Uploads disabled.</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {deal.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{doc.name}</span>
                      {renderStatusBadge(doc.openaiStatus)}
                    </div>
                    <span className="text-xs text-slate-500">{doc.mimeType}</span>
                  </li>
                ))}
                {deal.documents.length === 0 && <p className="text-sm text-slate-500">No documents yet.</p>}
              </ul>
            </div>
          )}

          {binderTab === 'evidence' && (
            <div className="space-y-2">
              {activeRun ? (
                activeRun.evidenceSnippets.length > 0 ? (
                  activeRun.evidenceSnippets.map((snippet) => (
                    <div key={snippet.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{snippet.fileName || 'Snippet'}</span>
                        {typeof snippet.score === 'number' && <span className="text-xs text-slate-500">Score: {snippet.score.toFixed(3)}</span>}
                      </div>
                      <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{snippet.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No evidence snippets stored for this run.</p>
                )
              ) : (
                <p className="text-sm text-slate-500">Run an analysis to populate the evidence binder.</p>
              )}
            </div>
          )}
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Latest scorecard</h2>
          {activeRun ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Summary</p>
              <p className="text-slate-600">{activeRun.summary}</p>
              <p className="text-xs text-slate-500">Run at {new Date(activeRun.createdAt).toLocaleString()}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {renderRunStatus(activeRun.status)}
                {activeRun.modelUsed && <span>Model: {activeRun.modelUsed}</span>}
              </div>
              {activeRun.errorMessage && <p className="text-xs text-rose-600">Error: {activeRun.errorMessage}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No analysis yet. Run to generate the IC pack skeleton.</p>
          )}
        </div>
      </div>

      {activeRun && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-4 lg:col-span-2">
            <h3 className="font-semibold">Scorecard</h3>
            <div className="mt-3 space-y-2">
              {(activeRun.scorecard as any[]).map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{item.criterion}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{item.rationale}</p>
                  {item.citations && (item.citations as string[]).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-brand">
                      {(item.citations as string[]).map((citation) => (
                        <button
                          key={citation}
                          className="underline"
                          onClick={() => setSelectedSnippet(snippetMap[citation] || null)}
                          disabled={!snippetMap[citation]}
                        >
                          View snippet {citation.slice(0, 6)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold">Checklist</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {(activeRun.checklist as any[]).map((item, idx) => (
                <li key={idx} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="font-semibold">{item.question}</p>
                  <p className="text-xs text-slate-500">Priority: {item.priority}</p>
                </li>
              ))}
              {(activeRun.checklist as any[]).length === 0 && <p className="text-sm text-slate-500">No outstanding items.</p>}
            </ul>
          </div>
        </div>
      )}

      {activeRun && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Market context</h3>
              <p className="text-xs text-slate-500">Official-only guidance with citations.</p>
            </div>
          </div>
          {marketResearch?.summary ? (
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <p className="whitespace-pre-wrap">{marketResearch.summary}</p>
              {marketResearch.citations && marketResearch.citations.length > 0 && (
                <div className="space-y-1 text-xs text-brand">
                  <p className="font-semibold text-slate-900">Citations</p>
                  <div className="flex flex-wrap gap-2">
                    {marketResearch.citations.map((c) => (
                      <a key={c} href={c} target="_blank" rel="noreferrer" className="underline">
                        {c}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">Sources consulted</p>
                <ul className="list-disc space-y-1 pl-4">
                  {(marketResearch.sources || []).map((s) => (
                    <li key={s}>
                      <a href={s} target="_blank" rel="noreferrer" className="text-brand underline">
                        {s}
                      </a>
                    </li>
                  ))}
                  {(marketResearch.sources || []).length === 0 && <li className="list-none text-slate-500">None listed.</li>}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Market research was not requested or no official domains were available for this country.
            </p>
          )}
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Run history</h3>
          <p className="text-xs text-slate-500">Tracks each Prompt 3.5 execution with outcomes.</p>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-sm">
          {analyses.map((run) => (
            <button
              key={run.id}
              className={`flex w-full items-center justify-between px-2 py-3 text-left ${run.id === activeRun?.id ? 'bg-slate-50' : ''}`}
              onClick={() => setActiveRunId(run.id)}
            >
              <div>
                <p className="font-semibold text-slate-900">{new Date(run.createdAt).toLocaleString()}</p>
                <p className="text-xs text-slate-500">{run.summary}</p>
                {run.errorMessage && <p className="text-xs text-rose-600">{run.errorMessage}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
                {renderRunStatus(run.status)}
                {run.modelUsed && <span>Model: {run.modelUsed}</span>}
              </div>
            </button>
          ))}
          {analyses.length === 0 && <p className="py-3 text-sm text-slate-500">No historical runs captured.</p>}
        </div>
      </div>

      {message && <p className="text-sm text-brand">{message}</p>}

      {selectedSnippet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-2xl rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Snippet {selectedSnippet.snippetId}</p>
                <p className="font-semibold text-slate-900">{selectedSnippet.fileName || 'Evidence snippet'}</p>
              </div>
              <button className="text-sm text-brand" onClick={() => setSelectedSnippet(null)}>Close</button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selectedSnippet.text}</p>
            {typeof selectedSnippet.score === 'number' && <p className="mt-2 text-xs text-slate-500">Retrieval score: {selectedSnippet.score.toFixed(3)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
