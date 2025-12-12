const DOMAIN_SPLIT_REGEX = /[\n,]+/;

function normalizeDomain(value: string) {
  let domain = value.trim().toLowerCase();
  if (!domain) return '';
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split(/[?#]/)[0];
  domain = domain.split('/')[0];
  domain = domain.replace(/[./]+$/, '');
  domain = domain.replace(/\.+$/, '');
  return domain.trim();
}

export function sanitizeAllowedDomainsInput(raw: string | string[]) {
  const tokens = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(DOMAIN_SPLIT_REGEX)
        .map((entry) => entry.trim())
        .filter(Boolean);

  const sanitizedSet = new Set<string>();
  const invalid: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeDomain(token);
    if (!normalized || /\s/.test(normalized) || normalized.includes('/') || normalized.includes('://')) {
      invalid.push(token);
      continue;
    }
    sanitizedSet.add(normalized);
  }

  const sanitized = Array.from(sanitizedSet.values());

  return {
    sanitized,
    invalid,
    tooMany: sanitized.length > 100,
  };
}

export function normalizeUrlForClick(url: string) {
  const trimmed = url?.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
