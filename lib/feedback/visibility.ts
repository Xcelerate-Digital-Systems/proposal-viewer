// Stage-based visibility rules for the feedback module.
//
// A guest is anyone accessing the project via a public share_token — they
// have no authenticated session and are not in `team_members`. They must
// never see items, comments, or kanban columns scoped to an internal stage.
//
// The status list lives in lib/feedback/status.tsx > REVIEW_STATUS_ORDER.
// Keep the two sets here in sync with that enum.

import type { FeedbackStatus } from '@/lib/types/feedback';

/** Stages the public/guest viewer can render and the API can return. */
export const GUEST_VISIBLE_STAGES: FeedbackStatus[] = [
  'internal_review',
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

/** Stages explicitly internal — items here are filtered out of every
 *  public-token route response and the public kanban columns are not shown. */
export const INTERNAL_STAGES: FeedbackStatus[] = [
  'draft',
  'in_progress',
];

export function isGuestVisibleStage(status: string | null | undefined): boolean {
  return !!status && (GUEST_VISIBLE_STAGES as string[]).includes(status);
}

export function isInternalStage(status: string | null | undefined): boolean {
  return !!status && (INTERNAL_STAGES as string[]).includes(status);
}
