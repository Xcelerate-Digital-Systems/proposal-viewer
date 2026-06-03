import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import type { FeedbackStatus } from '@/lib/types/feedback';

const CLIENT_ALLOWED_STATUSES: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

// Status → decision mapping. `client_review` (re-opening a vote) intentionally
// has no decision so we don't log spurious votes; only approve/request-changes
// (and outright reject, which behaves like changes_requested at the per-vote
// level) create a row.
const DECISION_FOR_STATUS: Partial<Record<FeedbackStatus, 'approved' | 'changes_requested'>> = {
  approved: 'approved',
  revision_needed: 'changes_requested',
  rejected: 'changes_requested',
};

/** Where an "Approved" vote on a given stage advances the item to once *every*
 *  assigned reviewer for that stage has approved. Stages outside this map
 *  don't auto-advance — internal_review → client_review (move to client),
 *  client_review → approved (done). For other stages, a single vote sets
 *  status directly (legacy behaviour). */
const NEXT_STAGE_ON_FULL_APPROVAL: Partial<Record<string, FeedbackStatus>> = {
  internal_review: 'client_review',
  client_review: 'approved',
};

/**
 * POST /api/review/[token]/items/[itemId]/status
 *
 * Allows a client viewing a share link to change an item's status to one of
 * the client-facing values (approve, request revision, reject). Token can be
 * either a project share_token or an item share_token; the target item must
 * belong to the resolved project (or match the item token itself) so a client
 * can't update unrelated items by guessing ids.
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string; itemId: string }> }
) {
  const params = await props.params;

  const rl = await rateLimit({ key: `review:status:${params.token || ipFromRequest(req)}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 20) });
  }

  try {
    const body = await req.json().catch(() => null);
    const status: FeedbackStatus | undefined = body?.status;
    if (!status || !CLIENT_ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve the review project this token grants access to — either a
    // project-level token or an item-level token pointing into the project.
    const { data: itemByToken } = await supabase
      .from('review_items')
      .select('id, review_project_id')
      .eq('share_token', params.token)
      .maybeSingle();

    let projectId: string | null = itemByToken?.review_project_id ?? null;

    if (!projectId) {
      const { data: projectByToken } = await supabase
        .from('review_projects')
        .select('id')
        .eq('share_token', params.token)
        .maybeSingle();
      projectId = projectByToken?.id ?? null;
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Ensure the target item belongs to that project before updating.
    const { data: target } = await supabase
      .from('review_items')
      .select('id, review_project_id, company_id, status')
      .eq('id', params.itemId)
      .maybeSingle();

    if (!target || target.review_project_id !== projectId) {
      return NextResponse.json({ error: 'Item not in this review' }, { status: 404 });
    }

    const reviewerEmail = typeof body?.reviewer_email === 'string'
      ? body.reviewer_email.trim().toLowerCase() : '';
    const reviewerName = typeof body?.reviewer_name === 'string'
      ? body.reviewer_name.trim() : '';
    const decisionNote = typeof body?.decision_note === 'string'
      ? body.decision_note.slice(0, 1000) : null;
    const decisionKind = DECISION_FOR_STATUS[status];
    const currentStage = target.status as string;

    // Filestage-style "all reviewers must approve" gate. Only applies when:
    //   - the reviewer voted Approve
    //   - the current stage is internal_review or client_review
    //   - that stage has at least one explicit assignee (member or guest with
    //     this stage in their `stages` array)
    // In that case, the reviewer's vote is recorded but item.status DOES NOT
    // jump to `approved` immediately — it advances to the next stage only
    // once every assignee on the current stage has an approve vote.
    let effectiveTargetStatus: FeedbackStatus = status;
    let gateInfo: { applied: boolean; assignees: number; approvers: number } | null = null;

    if (
      decisionKind === 'approved' &&
      currentStage in NEXT_STAGE_ON_FULL_APPROVAL &&
      reviewerEmail
    ) {
      // Pull current stage's roster (member + guest assignments scoped to this
      // stage; empty `stages` arrays = "all stages" back-compat and count too).
      const [{ data: memberRows }, { data: guestRows }] = await Promise.all([
        supabase
          .from('review_project_assignees')
          .select('team_member_id, stages, team_member:team_members(email)')
          .eq('review_project_id', projectId),
        supabase
          .from('review_project_guest_recipients')
          .select('email, stages, removed_at')
          .eq('review_project_id', projectId),
      ]);

      const stageMemberEmails = new Set<string>();
      for (const row of (memberRows ?? []) as unknown as Array<{
        team_member_id: string;
        stages: string[] | null;
        team_member: { email: string | null } | { email: string | null }[] | null;
      }>) {
        const scoped = !row.stages || row.stages.length === 0 || row.stages.includes(currentStage);
        if (!scoped) continue;
        const rel = row.team_member;
        const tms = Array.isArray(rel) ? rel : rel ? [rel] : [];
        for (const tm of tms) {
          const e = tm?.email?.trim().toLowerCase();
          if (e) stageMemberEmails.add(e);
        }
      }
      const stageGuestEmails = new Set<string>();
      for (const row of (guestRows ?? []) as { email: string; stages: string[] | null; removed_at: string | null }[]) {
        if (row.removed_at) continue;
        const scoped = !row.stages || row.stages.length === 0 || row.stages.includes(currentStage);
        if (!scoped) continue;
        stageGuestEmails.add(row.email.trim().toLowerCase());
      }
      const assigneeUniverse = new Set<string>();
      stageMemberEmails.forEach((e) => assigneeUniverse.add(e));
      stageGuestEmails.forEach((e) => assigneeUniverse.add(e));

      if (assigneeUniverse.size > 0) {
        // The gate applies. The reviewer's "approve" intent is recorded as a
        // decision but doesn't force the global status to `approved` — that
        // only happens once everyone else has approved too.
        gateInfo = { applied: true, assignees: assigneeUniverse.size, approvers: 0 };

        // Pre-write count + this voter (use the voter's email so we count
        // them in the check that follows without a second round-trip).
        const { data: priorApprovers } = await supabase
          .from('review_item_decisions')
          .select('reviewer_email')
          .eq('review_item_id', params.itemId)
          .eq('stage', currentStage)
          .eq('decision', 'approved');
        const approverSet = new Set<string>(
          (priorApprovers ?? [])
            .map((r) => (r as { reviewer_email: string | null }).reviewer_email?.trim().toLowerCase())
            .filter((e): e is string => !!e),
        );
        if (assigneeUniverse.has(reviewerEmail)) approverSet.add(reviewerEmail);

        gateInfo.approvers = approverSet.size;

        // Are we at the threshold? Every assignee email must be in approver set.
        let allApproved = true;
        assigneeUniverse.forEach((a) => {
          if (!approverSet.has(a)) allApproved = false;
        });

        effectiveTargetStatus = allApproved
          ? NEXT_STAGE_ON_FULL_APPROVAL[currentStage]!
          : (currentStage as FeedbackStatus); // hold position
      }
      // assigneeUniverse.size === 0 → no gate, fall through to legacy direct-update.
    }

    // Conditional update: only apply if the item is still in the expected stage.
    // This prevents TOCTOU races where two concurrent voters both read the same
    // pre-existing state and double-advance.
    const { data: updated, error } = await supabase
      .from('review_items')
      .update({ status: effectiveTargetStatus, updated_at: new Date().toISOString() })
      .eq('id', params.itemId)
      .eq('status', currentStage)
      .select('id, status')
      .maybeSingle();

    if (error) {
      console.error('[api/review/[token]/items/[itemId]/status] POST:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // If no row was updated, the item's status changed between our read and
    // write (concurrent voter). Return 409 so the client can refresh.
    if (!updated) {
      return NextResponse.json(
        { error: 'Item status changed concurrently, please refresh and try again' },
        { status: 409 },
      );
    }

    // Record the per-reviewer decision after the status is written so the
    // gate computation above isn't perturbed by reading our own write. Vote
    // is stamped against the *current* stage (the one being decided on), not
    // the stage we may have just advanced to.
    if (decisionKind && reviewerEmail && currentStage) {
      try {
        await supabase.from('review_item_decisions').upsert(
          {
            review_item_id: params.itemId,
            company_id: target.company_id,
            stage: currentStage,
            reviewer_kind: 'guest',
            reviewer_email: reviewerEmail,
            reviewer_name: reviewerName || null,
            decision: decisionKind,
            decision_note: decisionNote,
            decided_at: new Date().toISOString(),
          },
          { onConflict: 'review_item_id,stage,reviewer_email' },
        );
      } catch (decisionErr) {
        // Non-fatal — the status change is the canonical event. Vote log
        // failures shouldn't block the public reviewer.
        console.error('Decision log failed:', decisionErr);
      }
    }

    // Fire notification when the status actually changed to a notifiable state.
    const statusChanged = effectiveTargetStatus !== currentStage;
    const notifyEvent =
      effectiveTargetStatus === 'approved'
        ? 'review_item_approved'
        : effectiveTargetStatus === 'revision_needed' || effectiveTargetStatus === 'rejected'
          ? 'review_item_revision_needed'
          : null;

    if (statusChanged && notifyEvent) {
      try {
        const { data: proj } = await supabase
          .from('review_projects')
          .select('share_token')
          .eq('id', projectId)
          .maybeSingle();

        const { data: itemData } = await supabase
          .from('review_items')
          .select('title')
          .eq('id', params.itemId)
          .maybeSingle();

        if (proj?.share_token) {
          const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
          fetch(`${appUrl}/api/review-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': process.env.SUPABASE_SERVICE_ROLE_KEY || '' },
            body: JSON.stringify({
              event_type: notifyEvent,
              share_token: proj.share_token,
              review_item_id: params.itemId,
              item_title: itemData?.title ?? null,
              comment_author: reviewerName || null,
              comment_author_email: reviewerEmail || null,
            }),
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({
      success: true,
      item: updated,
      gate: gateInfo,
    });
  } catch (err) {
    console.error('[api/review/[token]/items/[itemId]/status]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
