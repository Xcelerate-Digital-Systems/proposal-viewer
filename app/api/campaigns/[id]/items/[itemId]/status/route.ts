import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';
import type { FeedbackStatus } from '@/lib/types/feedback';

const VALID_STATUSES = ['draft', 'in_progress', 'internal_review', 'client_review', 'approved', 'revision_needed', 'rejected', 'archived'];

/** Status → decision mapping (matches public review route). */
const DECISION_FOR_STATUS: Partial<Record<FeedbackStatus, 'approved' | 'changes_requested'>> = {
  approved: 'approved',
  revision_needed: 'changes_requested',
  rejected: 'changes_requested',
};

/** Where an "Approved" vote advances the item once every assigned reviewer
 *  for that stage has approved. Matches the public review route. */
const NEXT_STAGE_ON_FULL_APPROVAL: Partial<Record<string, FeedbackStatus>> = {
  internal_review: 'client_review',
  client_review: 'approved',
};

export async function POST(req: NextRequest, props: { params: Promise<{ id: string; itemId: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await authRateLimit(auth.companyId, 'campaigns/items/status');
  if (limited) return limited;

  if (!auth.member.is_super_admin && auth.accountType !== 'agency') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status as FeedbackStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from('review_items')
    .select('id, review_project_id, company_id, status')
    .eq('id', params.itemId)
    .single();

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();

  if (!project || project.company_id !== auth.companyId || item.review_project_id !== project.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Resolve the current user's email for decision tracking.
  const reviewerEmail = (
    (auth.member as Record<string, unknown>).email as string || ''
  ).trim().toLowerCase();
  const reviewerName = (
    (auth.member as Record<string, unknown>).full_name as string ||
    (auth.member as Record<string, unknown>).name as string || ''
  ).trim();
  const decisionNote = typeof body?.decision_note === 'string'
    ? body.decision_note.slice(0, 1000) : null;
  const decisionKind = DECISION_FOR_STATUS[status];
  const currentStage = item.status as string;

  // --- Auto-advance gate (mirrors public review route) ---
  let effectiveTargetStatus: FeedbackStatus = status;
  let gateInfo: { applied: boolean; assignees: number; approvers: number } | null = null;

  if (
    decisionKind === 'approved' &&
    currentStage in NEXT_STAGE_ON_FULL_APPROVAL &&
    reviewerEmail
  ) {
    const [{ data: memberRows }, { data: guestRows }] = await Promise.all([
      supabase
        .from('review_project_assignees')
        .select('team_member_id, stages, team_member:team_members(email)')
        .eq('review_project_id', project.id),
      supabase
        .from('review_project_guest_recipients')
        .select('email, stages, removed_at')
        .eq('review_project_id', project.id),
    ]);

    const assigneeUniverse = new Set<string>();

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
        if (e) assigneeUniverse.add(e);
      }
    }
    for (const row of (guestRows ?? []) as { email: string; stages: string[] | null; removed_at: string | null }[]) {
      if (row.removed_at) continue;
      const scoped = !row.stages || row.stages.length === 0 || row.stages.includes(currentStage);
      if (!scoped) continue;
      assigneeUniverse.add(row.email.trim().toLowerCase());
    }

    if (assigneeUniverse.size > 0) {
      gateInfo = { applied: true, assignees: assigneeUniverse.size, approvers: 0 };

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

      let allApproved = true;
      assigneeUniverse.forEach((a) => {
        if (!approverSet.has(a)) allApproved = false;
      });

      effectiveTargetStatus = allApproved
        ? NEXT_STAGE_ON_FULL_APPROVAL[currentStage]!
        : (currentStage as FeedbackStatus); // hold position
    }
    // assigneeUniverse.size === 0 → no gate, fall through to direct update.
  }

  // When moving backward to a review stage, clear stale approval/rejection
  // votes so reviewers must re-evaluate the content. This prevents old
  // decisions from triggering auto-advance on un-reviewed content.
  const REVIEW_STAGES: string[] = ['internal_review', 'client_review'];
  if (REVIEW_STAGES.includes(effectiveTargetStatus) && effectiveTargetStatus !== currentStage) {
    await supabase
      .from('review_item_decisions')
      .delete()
      .eq('review_item_id', params.itemId)
      .eq('stage', effectiveTargetStatus);
  }

  const { data: updated, error } = await supabase
    .from('review_items')
    .update({ status: effectiveTargetStatus, updated_at: new Date().toISOString() })
    .eq('id', params.itemId)
    .select('id, status')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });

  // Record the per-reviewer decision after the status write so the gate
  // computation above isn't perturbed by reading our own write.
  if (decisionKind && reviewerEmail && currentStage) {
    try {
      await supabase.from('review_item_decisions').upsert(
        {
          review_item_id: params.itemId,
          company_id: item.company_id,
          stage: currentStage,
          reviewer_kind: 'member',
          reviewer_email: reviewerEmail,
          reviewer_name: reviewerName || null,
          decision: decisionKind,
          decision_note: decisionNote,
          decided_at: new Date().toISOString(),
        },
        { onConflict: 'review_item_id,stage,reviewer_email' },
      );
    } catch (decisionErr) {
      // Non-fatal — the status change is the canonical event.
      console.error('Decision log failed:', decisionErr);
    }
  }

  return NextResponse.json({ success: true, item: updated, gate: gateInfo });
}
