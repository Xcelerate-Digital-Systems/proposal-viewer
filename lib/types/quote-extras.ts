// lib/types/quote-extras.ts
// Per-quote content blocks rendered by the single-page quote viewer. Stored
// as JSONB on proposals.quote_extras (only meaningful when entity_type='quote').

export interface QuoteExtras {
  about_us: string;
  testimonial: string;
  testimonial_author: string;
  terms: string;
  /** Up to three short trust badges shown under the cover (e.g. "Licensed & Insured"). */
  badges: string[];
}

export const DEFAULT_QUOTE_TERMS = `Payment is due within 14 days of invoice date. A deposit of 30% is required before work commences. All prices include GST.`;

export const DEFAULT_QUOTE_BADGES: string[] = [
  'Licensed & Insured',
  '5-Star Rated',
  '10+ Years Experience',
];

export const DEFAULT_QUOTE_EXTRAS: QuoteExtras = {
  about_us: '',
  testimonial: '',
  testimonial_author: '',
  terms: DEFAULT_QUOTE_TERMS,
  badges: [...DEFAULT_QUOTE_BADGES],
};

export function parseQuoteExtras(raw: unknown): QuoteExtras {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_QUOTE_EXTRAS };
  const r = raw as Record<string, unknown>;
  return {
    about_us: typeof r.about_us === 'string' ? r.about_us : DEFAULT_QUOTE_EXTRAS.about_us,
    testimonial: typeof r.testimonial === 'string' ? r.testimonial : DEFAULT_QUOTE_EXTRAS.testimonial,
    testimonial_author:
      typeof r.testimonial_author === 'string'
        ? r.testimonial_author
        : DEFAULT_QUOTE_EXTRAS.testimonial_author,
    terms: typeof r.terms === 'string' ? r.terms : DEFAULT_QUOTE_TERMS,
    badges:
      Array.isArray(r.badges) && r.badges.every((b) => typeof b === 'string')
        ? (r.badges as string[]).slice(0, 3)
        : [...DEFAULT_QUOTE_BADGES],
  };
}
