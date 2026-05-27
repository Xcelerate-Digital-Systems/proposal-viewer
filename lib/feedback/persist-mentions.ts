// Replace the mention set for a given review_comment based on its HTML
// content. Validates each extracted mention against the project's
// participant list so a forged data-id can't smuggle in an arbitrary email.
// Idempotent: deleting + inserting inside a transaction keeps the join
// table consistent with the comment's current content.

import { extractMentionsFromHtml } from './mention-html';
import { getProjectParticipants, type Participant } from './participants';
import type { createServiceClient } from '@/lib/supabase-server';

export interface PersistedMention {
  reviewCommentId: string;
  teamMemberId: string | null;
  targetEmail: string;
  displayName: string;
  targetKind: 'team' | 'guest';
}

/**
 * Replace the mention set for a comment. Returns the resolved mentions so
 * the caller can dispatch notifications without re-querying.
 *
 * If `projectId` is provided we use it; otherwise we resolve via the
 * comment's review_item_id. `actorEmail` is excluded from the result so
 * the comment author doesn't notify themselves when they @ their own name.
 */
export async function syncCommentMentions(
  supabase: ReturnType<typeof createServiceClient>,
  args: {
    commentId: string;
    content: string;
    projectId?: string | null;
    actorEmail?: string | null;
  }
): Promise<PersistedMention[]> {
  // Always clear first so an edit that removes a mention also removes the
  // pending notification target.
  await supabase
    .from('review_comment_mentions')
    .delete()
    .eq('review_comment_id', args.commentId);

  const extracted = extractMentionsFromHtml(args.content);
  if (extracted.length === 0) return [];

  // Resolve the project id (we need it to load participants).
  let projectId = args.projectId ?? null;
  if (!projectId) {
    const { data: row } = await supabase
      .from('review_comments')
      .select('review_item_id, review_items:review_item_id(review_project_id)')
      .eq('id', args.commentId)
      .maybeSingle();
    const rel = (row as { review_items?: { review_project_id?: string } | { review_project_id?: string }[] } | null)?.review_items;
    const arr = Array.isArray(rel) ? rel : rel ? [rel] : [];
    projectId = arr[0]?.review_project_id ?? null;
  }
  if (!projectId) return [];

  const participants = await getProjectParticipants(supabase, projectId, {
    excludeEmail: args.actorEmail ?? null,
  });
  const byId = new Map<string, Participant>(participants.map((p) => [p.id, p]));

  const seenEmail = new Set<string>();
  const rows: PersistedMention[] = [];
  for (const m of extracted) {
    const p = byId.get(m.id);
    if (!p) continue;
    if (seenEmail.has(p.email)) continue;
    seenEmail.add(p.email);
    rows.push({
      reviewCommentId: args.commentId,
      teamMemberId: p.kind === 'team' ? p.id : null,
      targetEmail: p.email,
      displayName: p.name,
      targetKind: p.kind,
    });
  }

  if (rows.length > 0) {
    await supabase.from('review_comment_mentions').insert(
      rows.map((r) => ({
        review_comment_id: r.reviewCommentId,
        team_member_id: r.teamMemberId,
        target_email: r.targetEmail,
        display_name: r.displayName,
        target_kind: r.targetKind,
      }))
    );
  }

  return rows;
}
