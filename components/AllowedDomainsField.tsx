'use client';

import { useMemo, useState } from 'react';
import { sanitizeAllowedDomainsInput } from '@/lib/allowedDomains';

export default function AllowedDomainsField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const { sanitized, invalid, tooMany } = useMemo(() => sanitizeAllowedDomainsInput(value), [value]);
  const invalidEntries = invalid.filter(Boolean);

  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-600">Official allowed domains for web search</label>
      <textarea
        name="allowedDomains"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full"
        rows={3}
        placeholder="example.gov, tso.int\nenergy.example"
      ></textarea>
      <div className="flex items-center justify-between text-xs">
        <span className={sanitized.length > 100 || tooMany ? 'text-rose-600' : 'text-slate-500'}>
          {sanitized.length} / 100 domains
        </span>
        {invalidEntries.length > 0 && <span className="text-rose-600">Invalid entries detected</span>}
        {tooMany && <span className="text-rose-600">Reduce the list to 100 domains.</span>}
      </div>
      {invalidEntries.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-rose-600">
          {invalidEntries.map((entry) => (
            <li key={entry}>Invalid: {entry}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
