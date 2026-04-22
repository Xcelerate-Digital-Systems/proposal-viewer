import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import type { FeedbackStatus } from '@/lib/types/feedback';

const CLIENT_ALLOWED_STATUSES: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

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
  { params }: { params: { token: string; itemId: string } }
) {
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
      .select('id, review_project_id')
      .eq('id', params.itemId)
      .maybeSingle();

    if (!target || target.review_project_id !== projectId) {
      return NextResponse.json({ error: 'Item not in this review' }, { status: 404 });
    }

    const { data: updated, error } = await supabase
      .from('review_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', params.itemId)
      .select('id, status')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
