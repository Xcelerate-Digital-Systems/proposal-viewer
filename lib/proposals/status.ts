// lib/proposals/status.ts
//
// Status vocabulary shared by /proposals and /quotes (both live in the
// `proposals` table — quotes are just rows where entity_type='quote').
//
// Mirrors the FeedbackStatus config shape so the same kanban board can
// render either entity without per-page special-casing.

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';

export interface ProposalStatusDef {
  value: ProposalStatus;
  label: string;
  /** Solid hex used on the kanban column dot. */
  hex: string;
}

export const PROPOSAL_STATUS_ORDER: ProposalStatus[] = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
];

export const PROPOSAL_STATUS_CONFIG: Record<ProposalStatus, ProposalStatusDef> = {
  draft: { value: 'draft', label: 'Draft', hex: '#9ca3af' },
  sent: { value: 'sent', label: 'Sent', hex: '#3b82f6' },
  viewed: { value: 'viewed', label: 'Viewed', hex: '#f59e0b' },
  accepted: { value: 'accepted', label: 'Accepted', hex: '#10b981' },
  declined: { value: 'declined', label: 'Declined', hex: '#ef4444' },
};

/**
 * Build the patch sent to the `proposals` table when a kanban card is
 * dragged into a new column. We also stamp the matching outcome timestamp
 * so admins moving cards manually don't see "Sent: never" type weirdness
 * in subsequent views.
 */
export function buildStatusPatch(next: ProposalStatus): Record<string, string | null> {
  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status: next,
    updated_at: now,
  };
  if (next === 'sent') patch.sent_at = now;
  if (next === 'viewed') patch.first_viewed_at = now;
  if (next === 'accepted') patch.accepted_at = now;
  if (next === 'declined') patch.declined_at = now;
  return patch;
}
