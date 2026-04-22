import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * POST /api/review/[token]/complete
 *
 * Records that a reviewer has finished reviewing the shared project, with
 * an optional message. Fires the `review_feedback_marked_complete` webhook
 * + team email via /api/review-notify.
 *
 * Token must be a review_projects.share_token.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const {
      reviewer_name,
      reviewer_email,
      message,
    } = body as { reviewer_name?: string; reviewer_email?: string; message?: string };

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, company_id, share_token, title')
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const trimmedName = reviewer_name?.trim() || null;
    const trimmedEmail = reviewer_email?.trim() || null;
    const trimmedMessage = message?.trim() || null;

    const { data: row, error: insertErr } = await supabase
      .from('review_completions')
      .insert({
        review_project_id: project.id,
        reviewer_name: trimmedName,
        reviewer_email: trimmedEmail,
        message: trimmedMessage,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('review_completions insert failed:', insertErr);
      return NextResponse.json({ error: 'Failed to record completion' }, { status: 500 });
    }

    // Fire team email + webhook asynchronously — the reviewer's UX doesn't
    // need to wait on downstream notifications.
    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      void fetch(`${appUrl}/api/review-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'review_feedback_marked_complete',
          share_token: project.share_token,
          comment_author: trimmedName ?? 'A reviewer',
          comment_content: trimmedMessage ?? '',
          author_type: 'client',
        }),
      }).catch((err) => {
        console.error('review-notify dispatch failed:', err);
      });
    } catch (err) {
      console.error('review-notify dispatch threw:', err);
    }

    return NextResponse.json({ ok: true, id: row?.id ?? null });
  } catch (err) {
    console.error('Review completion error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
