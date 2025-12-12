'use client';

import React from 'react';
import { normalizeUrlForClick } from '@/lib/allowedDomains';

export type MarketResearchPayload =
  | {
      status: 'COMPLETED';
      summary: string;
      sources: string[];
      citations: string[];
      officialChecks?: string[];
    }
  | {
      status: 'SKIPPED' | 'FAILED' | undefined;
      reason?: string;
      summary?: string;
      sources?: string[];
      citations?: string[];
      officialChecks?: string[];
    };

export default function MarketContextSection({
  research,
  included,
}: {
  research?: MarketResearchPayload | null;
  included: boolean;
}) {
  const normalizedSources = (research?.sources || []).map(normalizeUrlForClick).filter(Boolean);
  const normalizedCitations = (research?.citations || []).map(normalizeUrlForClick).filter(Boolean);
  const status = research?.status;
  const hasSummary = status === 'COMPLETED' && research?.summary;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Market context</h3>
          <p className="text-xs text-slate-500">
            Market context is derived from official sources and is not used as evidence for deal-specific facts.
          </p>
        </div>
      </div>

      {!included && (
        <p className="mt-3 text-sm text-slate-500">Market research was not requested for this run.</p>
      )}

      {included && status === 'SKIPPED' && (
        <p className="mt-3 text-sm text-amber-700">
          Market research skipped: {research?.reason || 'No allowed domains configured'}.
        </p>
      )}

      {included && status === 'FAILED' && (
        <p className="mt-3 text-sm text-rose-700">Unable to retrieve official market research. {research?.reason}</p>
      )}

      {hasSummary && (
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p className="whitespace-pre-wrap">{research?.summary}</p>
          {normalizedCitations.length > 0 && (
            <div className="space-y-1 text-xs text-brand">
              <p className="font-semibold text-slate-900">Citations</p>
              <div className="flex flex-wrap gap-2">
                {normalizedCitations.map((c) => (
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
              {normalizedSources.map((s) => (
                <li key={s}>
                  <a href={s} target="_blank" rel="noreferrer" className="text-brand underline">
                    {s}
                  </a>
                </li>
              ))}
              {normalizedSources.length === 0 && <li className="list-none text-slate-500">None listed.</li>}
            </ul>
          </div>
        </div>
      )}

      {included && !hasSummary && status !== 'SKIPPED' && status !== 'FAILED' && (
        <p className="mt-3 text-sm text-slate-500">
          Market research was requested but did not return any official context for this run.
        </p>
      )}
    </div>
  );
}
