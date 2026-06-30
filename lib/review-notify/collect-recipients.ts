// lib/review-notify/collect-recipients.ts
// Resolves the set of recipient emails for a review notification event.

import { createServiceClient } from '@/lib/supabase-server';
import { isInternalStage } from '@/lib/feedback/visibility';

type ReviewEventType =
  | 'review_comment_added'
  | 'review_comment_resolved'
  | 'review_item_approved'
  | 'review_item_revision_needed'
  | 'review_item_rejected'
  | 'review_feedback_marked_complete'
  | 'review_item_new_version';

export type GuestPrefRow = {
  email: string;
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
  removed_at: string | null;
};

export async function collectRecipients(params: {
  supabase: ReturnType<typeof createServiceClient>;
  projectId: string;
  companyId: string;
  reviewItemId: string | null;
  itemStage: string | null;
  eventType: ReviewEventType;
  isComment: boolean;
  isReply: boolean;
  isNewVersion: boolean;
  parentCommentId: string | null;
  projectClientEmail: string | null;
  excludeEmail: string | null;
}): Promise<Set<string>> {
  const {
    supabase, projectId, companyId, reviewItemId, itemStage, eventType,
    isComment, isReply, isNewVersion,
    parentCommentId, projectClientEmail, excludeEmail,
  } = params;
  const recipients = new Set<string>();

  // Pick the per-assignee toggle column that gates this event.
  const prefColumn: string = isReply
    ? 'notify_reply'
    : isComment
    ? 'notify_comment'
    : eventType === 'review_comment_resolved'
    ? 'notify_resolve'
    : isNewVersion
    ? 'notify_new_version'
    : 'notify_status';

  // Assigned agency team members get the event when their toggle is on AND
  // (their `stages` array is empty — "all stages", back-compat — or includes
  // the item's current stage).
  const { data: assignees } = await supabase
    .from('review_project_assignees')
    .select('stages, team_member:team_members(email)')
    .eq('review_project_id', projectId)
    .eq(prefColumn, true);

  for (const row of (assignees ?? []) as unknown as Array<{
    stages: string[] | null;
    team_member: { email: string | null } | { email: string | null }[] | null;
  }>) {
    // Stage scope: skip assignees who limited themselves to specific stages
    // that don't include the current item stage. Project-level events with
    // no item (itemStage === null) bypass the scope filter.
    if (
      itemStage &&
      row.stages &&
      row.stages.length > 0 &&
      !row.stages.includes(itemStage)
    ) {
      continue;
    }
    // Supabase types the joined relation as either an array or a single
    // object depending on inference; normalise both shapes.
    const rel = row.team_member;
    const teamMembers = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const tm of teamMembers) {
      const email = tm?.email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  // New-version notifications also pull in the project's client_email plus
  // anyone who has previously commented on the item — they're the people
  // who asked for the revisions.
  if (isNewVersion && reviewItemId) {
    const clientEmail = projectClientEmail?.trim().toLowerCase();
    if (clientEmail) recipients.add(clientEmail);

    const { data: itemAuthors } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('review_item_id', reviewItemId)
      .not('author_email', 'is', null);
    for (const row of itemAuthors ?? []) {
      const email = (row as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  if (excludeEmail) recipients.delete(excludeEmail);

  // Apply guest-recipient overrides: if the project has stored prefs for
  // any of the (non-team-member) emails we collected, use them. Default
  // for emails with no row remains "all events on".
  await applyGuestPrefs({
    supabase,
    projectId,
    recipients,
    prefColumn: prefColumn as keyof GuestPrefRow,
    itemStage,
  });

  // Replies also notify prior thread participants (parent author + earlier
  // repliers). Collected AFTER applyGuestPrefs so that the same stage-scoping
  // and notification-pref checks apply — prevents guests from receiving
  // notifications for items in stages they shouldn't see.
  if (isComment && isReply && parentCommentId) {
    const threadEmails = new Set<string>();
    const { data: parent } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('id', parentCommentId)
      .maybeSingle();
    const parentEmail = parent?.author_email?.trim().toLowerCase();
    if (parentEmail) threadEmails.add(parentEmail);

    const { data: siblings } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('parent_comment_id', parentCommentId)
      .not('author_email', 'is', null);
    for (const row of siblings ?? []) {
      const email = (row as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (email) threadEmails.add(email);
    }

    if (excludeEmail) threadEmails.delete(excludeEmail);

    // Add thread participants then apply guest prefs so removed/toggled-off
    // guests and stage-scoped guests are filtered out.
    for (const email of Array.from(threadEmails)) recipients.add(email);
    await applyGuestPrefs({
      supabase,
      projectId,
      recipients,
      prefColumn: prefColumn as keyof GuestPrefRow,
      itemStage,
    });
  }

  // Hard backstop: if the event targets an item currently in an internal
  // stage, drop every non-team-member recipient. This protects against any
  // path that adds a guest email outside of `review_project_guest_recipients`
  // (e.g. thread participants, project client_email on new versions).
  if (itemStage && isInternalStage(itemStage) && recipients.size > 0) {
    const { data: teamRows } = await supabase
      .from('team_members')
      .select('email')
      .eq('company_id', companyId)
      .in('email', Array.from(recipients));
    const teamEmails = new Set(
      (teamRows ?? [])
        .map((r) => (r as { email: string | null }).email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    );
    for (const email of Array.from(recipients)) {
      if (!teamEmails.has(email)) recipients.delete(email);
    }
  }

  return recipients;
}

export async function applyGuestPrefs(params: {
  supabase: ReturnType<typeof createServiceClient>;
  projectId: string;
  recipients: Set<string>;
  prefColumn: keyof GuestPrefRow;
  itemStage: string | null;
}) {
  const { supabase, projectId, recipients, prefColumn, itemStage } = params;
  if (recipients.size === 0) return;

  const { data: rows } = await supabase
    .from('review_project_guest_recipients')
    .select('email, notify_comment, notify_reply, notify_resolve, notify_status, notify_new_version, removed_at, stages')
    .eq('review_project_id', projectId)
    .in('email', Array.from(recipients));

  for (const row of (rows ?? []) as (GuestPrefRow & { stages: string[] | null })[]) {
    const email = row.email.trim().toLowerCase();
    if (row.removed_at) {
      recipients.delete(email);
      continue;
    }
    if (row[prefColumn] === false) {
      recipients.delete(email);
      continue;
    }
    // Stage scoping for guests: when their `stages` array is non-empty and
    // the current item stage isn't in it, drop them. Project-level events
    // (itemStage === null) bypass the filter.
    if (
      itemStage &&
      row.stages &&
      row.stages.length > 0 &&
      !row.stages.includes(itemStage)
    ) {
      recipients.delete(email);
    }
  }
}
