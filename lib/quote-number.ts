// lib/quote-number.ts
// Format a per-company quote_number int as a client-facing string. Prefix and
// pad-width are configurable per company (companies.quote_number_prefix /
// .quote_number_pad_width) — defaults match the legacy "Q-001" shape so older
// callers without a company context render unchanged.

export interface QuoteNumberFormat {
  prefix?: string | null;
  padWidth?: number | null;
}

export function formatQuoteNumber(
  n: number | null | undefined,
  formatOrPrefix: QuoteNumberFormat | string = {},
): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const format: QuoteNumberFormat =
    typeof formatOrPrefix === 'string'
      ? { prefix: formatOrPrefix.endsWith('-') ? formatOrPrefix : `${formatOrPrefix}-` }
      : formatOrPrefix;
  const prefix = format.prefix ?? 'Q-';
  const pad = Math.max(1, format.padWidth ?? 3);
  return `${prefix}${String(n).padStart(pad, '0')}`;
}
