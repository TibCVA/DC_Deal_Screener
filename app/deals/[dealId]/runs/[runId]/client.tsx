'use client';

import { AnalysisEvidenceSnippet, AnalysisRun, Deal } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type RunWithEvidence = AnalysisRun & { evidenceSnippets: AnalysisEvidenceSnippet[]; deal: Deal };

export default function RunDetailClient({ run, confidence }: { run: RunWithEvidence; confidence: number }) {
  const [selectedSnippet, setSelectedSnippet] = useState<AnalysisEvidenceSnippet | null>(null);

  const snippetMap = useMemo(() => Object.fromEntries(run.evidenceSnippets.map((s) => [s.snippetId, s])), [run.evidenceSnippets]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Deal: {run.deal.name}</p>
          <h1 className="text-2xl font-semibold">Analysis run</h1>
          <p className="text-xs text-slate-500">Run ID: {run.id}</p>
        </div>
        <Link className="text-brand underline" href={`/deals/${run.dealId}`}>
          Back to workspace
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Status: {run.status}</p>
              {run.errorMessage && <p className="text-xs text-rose-600">{run.errorMessage}</p>}
              <p className="text-sm text-slate-500">Confidence score: {confidence}%</p>
            </div>
            <p className="text-xs text-slate-500">Executed: {new Date(run.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-semibold">Summary</p>
            <p className="text-sm text-slate-600">{run.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold">Scorecard</h3>
          <div className="mt-3 space-y-2">
            {(run.scorecard as any[]).map((item, idx) => (
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
            {(run.checklist as any[]).map((item, idx) => (
              <li key={idx} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="font-semibold">{item.question}</p>
                <p className="text-xs text-slate-500">Priority: {item.priority}</p>
              </li>
            ))}
            {(run.checklist as any[]).length === 0 && <p className="text-sm text-slate-500">No outstanding items.</p>}
          </ul>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold">Evidence binder</h3>
        <div className="mt-3 space-y-2">
          {run.evidenceSnippets.length === 0 && <p className="text-sm text-slate-500">No snippets stored for this run.</p>}
          {run.evidenceSnippets.map((snippet) => (
            <div key={snippet.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{snippet.fileName || 'Snippet'}</span>
                {typeof snippet.score === 'number' && <span className="text-xs text-slate-500">Score: {snippet.score.toFixed(3)}</span>}
              </div>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{snippet.text}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
                {snippet.dealDocumentId && <p>Document ID: {snippet.dealDocumentId}</p>}
                {snippet.openaiFileId && <p>OpenAI file: {snippet.openaiFileId}</p>}
                {snippet.metadata && <p>Metadata: {JSON.stringify(snippet.metadata)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

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
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              {typeof selectedSnippet.score === 'number' && <p>Retrieval score: {selectedSnippet.score.toFixed(3)}</p>}
              {selectedSnippet.dealDocumentId && <p>Document ID: {selectedSnippet.dealDocumentId}</p>}
              {selectedSnippet.openaiFileId && <p>OpenAI file: {selectedSnippet.openaiFileId}</p>}
              {selectedSnippet.metadata && <p>Metadata: {JSON.stringify(selectedSnippet.metadata)}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
