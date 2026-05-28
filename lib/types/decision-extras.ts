// lib/types/decision-extras.ts
// Per-proposal content for the synthetic Decision page — Next Steps + Terms,
// mirroring the QuoteExtras pattern. Stored as JSONB on proposals.decision_extras
// (only meaningful when entity_type='proposal'; quotes have their own column).

export interface DecisionExtras {
  /** Editable "Next Steps" lines shown above the accept form. Up to four. */
  next_steps: string[];
  /** Terms & conditions copy shown beneath Next Steps. */
  terms: string;
  /** Headline above the form when the Accept tab is selected. */
  accept_heading: string;
  /** Subtitle beneath the Accept headline. */
  accept_subtitle: string;
  /** Label next to the agreement checkbox on the Accept tab. */
  agreement_text: string;
  /** Submit button labels for each tab. */
  accept_button_label: string;
  decline_button_label: string;
  revision_button_label: string;
  /** Headline when the Decline tab is selected. */
  decline_heading: string;
  /** Subtitle beneath the Decline headline. */
  decline_subtitle: string;
  /** Headline when the Request Changes tab is selected. */
  revision_heading: string;
  /** Subtitle beneath the Request Changes headline. */
  revision_subtitle: string;
}

export const DEFAULT_DECISION_TERMS = `By accepting this proposal you agree to the scope of work outlined and the payment schedule. We'll reach out within one business day of acceptance to confirm next steps.`;

export const DEFAULT_DECISION_NEXT_STEPS: string[] = [
  'Review the proposal in your own time.',
  'Sign below to confirm — your typed name is your signature.',
  "Once accepted, we'll be in touch to kick things off.",
];

export const DEFAULT_DECISION_ACCEPT_HEADING = 'Ready to lock in your project?';
export const DEFAULT_DECISION_ACCEPT_SUBTITLE =
  'Sign below to confirm your project and secure your quoted price.';
export const DEFAULT_DECISION_AGREEMENT_TEXT =
  'I have read and agree to the proposal details and terms above.';

export const DEFAULT_DECISION_ACCEPT_BUTTON_LABEL = 'Accept & Confirm Quote';
export const DEFAULT_DECISION_DECLINE_BUTTON_LABEL = 'Decline Quote';
export const DEFAULT_DECISION_REVISION_BUTTON_LABEL = 'Request Changes';

export const DEFAULT_DECISION_DECLINE_HEADING = 'Decline this quote?';
export const DEFAULT_DECISION_DECLINE_SUBTITLE =
  "Let us know why if you'd like — it helps us improve.";
export const DEFAULT_DECISION_REVISION_HEADING = 'Request changes to this quote?';
export const DEFAULT_DECISION_REVISION_SUBTITLE =
  "Tell us what you'd like changed and we'll send a revised quote.";

export const DEFAULT_DECISION_EXTRAS: DecisionExtras = {
  next_steps: [...DEFAULT_DECISION_NEXT_STEPS],
  terms: DEFAULT_DECISION_TERMS,
  accept_heading: DEFAULT_DECISION_ACCEPT_HEADING,
  accept_subtitle: DEFAULT_DECISION_ACCEPT_SUBTITLE,
  agreement_text: DEFAULT_DECISION_AGREEMENT_TEXT,
  accept_button_label: DEFAULT_DECISION_ACCEPT_BUTTON_LABEL,
  decline_button_label: DEFAULT_DECISION_DECLINE_BUTTON_LABEL,
  revision_button_label: DEFAULT_DECISION_REVISION_BUTTON_LABEL,
  decline_heading: DEFAULT_DECISION_DECLINE_HEADING,
  decline_subtitle: DEFAULT_DECISION_DECLINE_SUBTITLE,
  revision_heading: DEFAULT_DECISION_REVISION_HEADING,
  revision_subtitle: DEFAULT_DECISION_REVISION_SUBTITLE,
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
    accept_heading:
      typeof r.accept_heading === 'string' && r.accept_heading.trim()
        ? r.accept_heading
        : DEFAULT_DECISION_ACCEPT_HEADING,
    accept_subtitle:
      typeof r.accept_subtitle === 'string' && r.accept_subtitle.trim()
        ? r.accept_subtitle
        : DEFAULT_DECISION_ACCEPT_SUBTITLE,
    agreement_text:
      typeof r.agreement_text === 'string' && r.agreement_text.trim()
        ? r.agreement_text
        : DEFAULT_DECISION_AGREEMENT_TEXT,
    accept_button_label:
      typeof r.accept_button_label === 'string' && r.accept_button_label.trim()
        ? r.accept_button_label
        : DEFAULT_DECISION_ACCEPT_BUTTON_LABEL,
    decline_button_label:
      typeof r.decline_button_label === 'string' && r.decline_button_label.trim()
        ? r.decline_button_label
        : DEFAULT_DECISION_DECLINE_BUTTON_LABEL,
    revision_button_label:
      typeof r.revision_button_label === 'string' && r.revision_button_label.trim()
        ? r.revision_button_label
        : DEFAULT_DECISION_REVISION_BUTTON_LABEL,
    decline_heading:
      typeof r.decline_heading === 'string' && r.decline_heading.trim()
        ? r.decline_heading
        : DEFAULT_DECISION_DECLINE_HEADING,
    decline_subtitle:
      typeof r.decline_subtitle === 'string' && r.decline_subtitle.trim()
        ? r.decline_subtitle
        : DEFAULT_DECISION_DECLINE_SUBTITLE,
    revision_heading:
      typeof r.revision_heading === 'string' && r.revision_heading.trim()
        ? r.revision_heading
        : DEFAULT_DECISION_REVISION_HEADING,
    revision_subtitle:
      typeof r.revision_subtitle === 'string' && r.revision_subtitle.trim()
        ? r.revision_subtitle
        : DEFAULT_DECISION_REVISION_SUBTITLE,
  };
}
