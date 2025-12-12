'use client';

import { AnalysisEvidenceSnippet, AnalysisRun, Deal, DealDocument, Role } from '@prisma/client';
import { useMemo, useState, useTransition } from 'react';

type AnalysisWithEvidence = AnalysisRun & { evidenceSnippets: AnalysisEvidenceSnippet[] };

export default function DealWorkspace({ deal, role }: { deal: Deal & { documents: DealDocument[]; analyses: AnalysisWithEvidence[] }; role: Role; }) {
  const [analyses, setAnalyses] = useState<AnalysisWithEvidence[]>(deal.analyses);
  const [uploading, setUploading] = useState(false);
  const [running, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [binderTab, setBinderTab] = useState<'uploads' | 'evidence'>('uploads');
  const [selectedSnippet, setSelectedSnippet] = useState<AnalysisEvidenceSnippet | null>(null);
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
        body: JSON.stringify({ dealId: deal.id }),
      });
      if (res.ok) {
        const data = (await res.json()) as AnalysisWithEvidence;
        setAnalyses((prev) => [data, ...prev]);
        setMessage('Analysis completed');
      } else {
        const body = await res.json().catch(() => ({}));
        setMessage(body.error || 'Analysis failed');
      }
    });
  }

  const latest = analyses[0];
  const snippetMap = useMemo(() => {
    if (!latest) return {} as Record<string, AnalysisEvidenceSnippet>;
    return Object.fromEntries(latest.evidenceSnippets.map((s) => [s.snippetId, s]));
  }, [latest]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{deal.country} • {deal.city} • {deal.type}</p>
          <h1 className="text-2xl font-semibold">{deal.name}</h1>
          <p className="text-sm text-slate-500">{deal.productType}</p>
        </div>
        <button onClick={runAnalysis} className="btn-primary" disabled={running || !canEdit}>
          {running ? 'Running…' : 'Run analysis'}
        </button>
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
              {latest ? (
                latest.evidenceSnippets.length > 0 ? (
                  latest.evidenceSnippets.map((snippet) => (
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
          {latest ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Summary</p>
              <p className="text-slate-600">{latest.summary}</p>
              <p className="text-xs text-slate-500">Run at {new Date(latest.createdAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No analysis yet. Run to generate the IC pack skeleton.</p>
          )}
        </div>
      </div>

      {latest && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-4 lg:col-span-2">
            <h3 className="font-semibold">Scorecard</h3>
            <div className="mt-3 space-y-2">
              {(latest.scorecard as any[]).map((item, idx) => (
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
              {(latest.checklist as any[]).map((item, idx) => (
                <li key={idx} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="font-semibold">{item.question}</p>
                  <p className="text-xs text-slate-500">Priority: {item.priority}</p>
                </li>
              ))}
              {(latest.checklist as any[]).length === 0 && <p className="text-sm text-slate-500">No outstanding items.</p>}
            </ul>
          </div>
        </div>
      )}

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
