'use client';

import { AnalysisRun, Deal, DealDocument, Role } from '@prisma/client';
import { useState, useTransition } from 'react';

export default function DealWorkspace({ deal, role }: { deal: Deal & { documents: DealDocument[]; analyses: AnalysisRun[] }; role: Role; }) {
  const [analyses, setAnalyses] = useState(deal.analyses);
  const [uploading, setUploading] = useState(false);
  const [running, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const canEdit = role === Role.ADMIN || role === Role.ANALYST;

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
        const data = await res.json();
        setAnalyses((prev) => [data, ...prev]);
        setMessage('Analysis completed');
      } else {
        const body = await res.json().catch(() => ({}));
        setMessage(body.error || 'Analysis failed');
      }
    });
  }

  const latest = analyses[0];

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
        <div className="card p-4 lg:col-span-2">
          <h2 className="font-semibold">Evidence binder</h2>
          <p className="text-sm text-slate-500">Upload dataroom docs and emails. Stored privately.</p>
          {canEdit ? (
            <form onSubmit={handleUpload} className="mt-3 flex items-center gap-3" encType="multipart/form-data">
              <input type="file" name="file" className="flex-1" required />
              <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">View-only access. Uploads disabled.</p>
          )}
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {deal.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>{doc.name}</span>
                <span className="text-xs text-slate-500">{doc.mimeType}</span>
              </li>
            ))}
            {deal.documents.length === 0 && <p className="text-sm text-slate-500">No documents yet.</p>}
          </ul>
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
    </div>
  );
}
