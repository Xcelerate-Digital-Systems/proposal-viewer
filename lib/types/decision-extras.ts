// lib/types/decision-extras.ts
// Per-proposal content for the synthetic Decision page — Next Steps + Terms,
// mirroring the QuoteExtras pattern. Stored as JSONB on proposals.decision_extras
// (only meaningful when entity_type='proposal'; quotes have their own column).

export interface DecisionExtras {
  /** Editable "Next Steps" lines shown above the accept form. Up to four. */
  next_steps: string[];
  /** Terms & conditions copy shown beneath Next Steps. */
  terms: string;
}

export const DEFAULT_DECISION_TERMS = `By accepting this proposal you agree to the scope of work outlined and the payment schedule. We'll reach out within one business day of acceptance to confirm next steps.`;

export const DEFAULT_DECISION_NEXT_STEPS: string[] = [
  'Review the proposal in your own time.',
  'Sign below to confirm — your typed name is your signature.',
  "Once accepted, we'll be in touch to kick things off.",
];

export const DEFAULT_DECISION_EXTRAS: DecisionExtras = {
  next_steps: [...DEFAULT_DECISION_NEXT_STEPS],
  terms: DEFAULT_DECISION_TERMS,
};

export function parseDecisionExtras(raw: unknown): DecisionExtras {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DECISION_EXTRAS };
  const r = raw as Record<string, unknown>;
  return {
    next_steps:
      Array.isArray(r.next_steps) && r.next_steps.every((s) => typeof s === 'string')
        ? (r.next_steps as string[]).slice(0, 4)
        : [...DEFAULT_DECISION_NEXT_STEPS],
    terms: typeof r.terms === 'string' ? r.terms : DEFAULT_DECISION_TERMS,
  };
}
