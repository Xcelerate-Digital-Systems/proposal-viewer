// lib/quote-number.ts
// Format a per-company quote_number int as a client-facing string. Zero-
// padded to three digits so QW-style "Q-014" reads cleanly even at low
// counts; rolls naturally to four+ digits at 1000+.

export function formatQuoteNumber(n: number | null | undefined, prefix = 'Q'): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
