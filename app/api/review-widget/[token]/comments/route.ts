// app/api/review-widget/[token]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { GUEST_VISIBLE_STAGES, isGuestVisibleStage } from '@/lib/feedback/visibility';
import { rateLimit } from '@/lib/rate-limit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/* ── Notification dispatch (fire-and-forget) ──────────── */
async function notifyWidgetCommentAsync(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    review_item_id: string;
    review_comment_id: string;
    review_project_id: string;
    author_name: string;
    author_email: string | null;
    content: string;
    parent_comment_id: string | null;
  },
) {
  try {
    const { data: project } = await supabase
      .from('review_projects')
      .select('share_token')
      .eq('id', params.review_project_id)
      .maybeSingle();
    if (!project?.share_token) return;

    const { data: item } = await supabase
      .from('review_items')
      .select('title')
      .eq('id', params.review_item_id)
      .maybeSingle();

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    await fetch(`${appUrl}/api/review-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'review_comment_added',
        share_token: project.share_token,
        review_item_id: params.review_item_id,
        review_comment_id: params.review_comment_id,
        comment_author: params.author_name,
        comment_author_email: params.author_email,
        comment_content: params.content,
        item_title: item?.title ?? null,
        parent_comment_id: params.parent_comment_id,
        author_type: 'client',
      }),
    });
  } catch (err) {
    console.error('Widget notification dispatch failed:', err);
  }
}

/* ── Preflight ──────────────────────────────────────────── */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ── Helpers ────────────────────────────────────────────── */
// Verify the widget caller can act on this item. Returns null when the token
// doesn't match the item's project, or when the item is currently in an
// internal stage — guests must never read/write comments on items they
// can't see. Authenticated admin reads bypass this route entirely.
async function verifyProjectAccess(supabase: ReturnType<typeof createServiceClient>, token: string, itemId: string) {
  const { data: item, error: itemErr } = await supabase
    .from('review_items')
    .select('id, company_id, review_project_id, status')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) return null;
  if (!isGuestVisibleStage(item.status)) return null;

  const { data: project, error: projErr } = await supabase
    .from('review_projects')
    .select('id, share_token')
    .eq('id', item.review_project_id)
    .eq('share_token', token)
    .single();

  if (projErr || !project) return null;

  return item;
}

/* ── GET — load comments for an item ────────────────────── */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const itemId = req.nextUrl.searchParams.get('item');

    if (!itemId) {
      return corsJson({ error: 'Missing item param' }, 400);
    }

    const item = await verifyProjectAccess(supabase, params.token, itemId);
    if (!item) {
      return corsJson({ error: 'Unauthorized' }, 403);
    }

    // Hide comments authored while the item was in an internal stage — even
    // after the item moves to a client-visible stage, that internal-stage
    // thread history must not surface in the guest widget.
    const { data: comments, error } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .in('stage_at_creation', GUEST_VISIBLE_STAGES)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Comments fetch error:', error);
      return corsJson({ error: 'Failed to load comments' }, 500);
    }

    // Enrich team-authored comments with the author's avatar URL so the
    // widget panel can render a real photo instead of an initial bubble.
    // Guests (author_user_id null) skip this lookup entirely.
    const userIds = Array.from(
      new Set(
        (comments || [])
          .map((c) => c.author_user_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const avatarByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, avatar_path')
        .in('user_id', userIds);
      for (const m of members || []) {
        if (!m.user_id || !m.avatar_path) continue;
        const { data: signed } = await supabase.storage
          .from('proposals')
          .createSignedUrl(m.avatar_path, 3600);
        if (signed?.signedUrl) avatarByUserId.set(m.user_id, signed.signedUrl);
      }
    }

    const enriched = (comments || []).map((c) => ({
      ...c,
      author_avatar_url: c.author_user_id ? avatarByUserId.get(c.author_user_id) ?? null : null,
    }));

    return corsJson({ comments: enriched });
  } catch (err) {
    console.error('Comments GET error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}

/* ── POST — create a comment ────────────────────────────── */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `review-widget:comments:${params.token}`, limit: 30, windowSeconds: 60 });
    if (!rl.success) return corsJson({ error: 'Too many requests' }, 429);

    const supabase = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return corsJson({ error: 'Invalid request body' }, 400);

    const {
      review_item_id,
      author_name,
      author_email,
      content,
      comment_type,
      pin_x,
      pin_y,
      pin_element_path,
      parent_comment_id,
      screenshot_url,
      annotation_data,
      highlight_text,
      highlight_start,
      highlight_end,
      highlight_element_path,
      priority,
      video_url,
    } = body;

    const VALID_PRIORITIES = ['high', 'medium', 'low', 'none'] as const;
    type Priority = typeof VALID_PRIORITIES[number];
    const safePriority: Priority = VALID_PRIORITIES.includes(priority) ? priority : 'none';

    if (!review_item_id || !author_name || !content || !comment_type) {
      return corsJson({ error: 'Missing required fields' }, 400);
    }

    const item = await verifyProjectAccess(supabase, params.token, review_item_id);
    if (!item) {
      return corsJson({ error: 'Unauthorized' }, 403);
    }

    // Determine thread_number for new top-level annotated comments (campaign-wide)
    const NUMBERED_TYPES = ['pin', 'box', 'text', 'screenshot', 'text_highlight'];
    let thread_number: number | null = null;
    if (!parent_comment_id && NUMBERED_TYPES.includes(comment_type)) {
      const { data: projectItems } = await supabase
        .from('review_items')
        .select('id')
        .eq('review_project_id', item.review_project_id);
      const projectItemIds = projectItems?.map((i) => i.id) ?? [review_item_id];
      const { data: maxRow } = await supabase
        .from('review_comments')
        .select('thread_number')
        .in('review_item_id', projectItemIds)
        .not('thread_number', 'is', null)
        .order('thread_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      thread_number = (maxRow?.thread_number ?? 0) + 1;
    }

    const { data: comment, error: insertErr } = await supabase
      .from('review_comments')
      .insert({
        review_item_id,
        company_id: item.company_id,
        parent_comment_id: parent_comment_id || null,
        thread_number,
        author_name: author_name.trim(),
        author_email: author_email?.trim() || null,
        author_type: 'client',
        content: content.trim(),
        comment_type,
        pin_x: pin_x ?? null,
        pin_y: pin_y ?? null,
        pin_element_path: pin_element_path || null,
        screenshot_url: screenshot_url || null,
        annotation_data: annotation_data || null,
        highlight_text: highlight_text || null,
        highlight_start: typeof highlight_start === 'number' ? highlight_start : null,
        highlight_end: typeof highlight_end === 'number' ? highlight_end : null,
        highlight_element_path: highlight_element_path || null,
        priority: safePriority,
        video_url: typeof video_url === 'string' ? video_url : null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Comment insert error:', insertErr);
      return corsJson({ error: 'Failed to post comment' }, 500);
    }

    // Fire participant notifications (matches public review route behaviour).
    void notifyWidgetCommentAsync(supabase, {
      review_item_id,
      review_comment_id: comment.id,
      review_project_id: item.review_project_id as string,
      author_name: author_name.trim(),
      author_email: author_email?.trim() || null,
      content: content.trim(),
      parent_comment_id: parent_comment_id || null,
    });

    return corsJson(comment);
  } catch (err) {
    console.error('Comment POST error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}

/* ── PATCH — resolve/unresolve OR edit comment content ─── */
export async function PATCH(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const commentId = req.nextUrl.searchParams.get('comment_id');
    const itemId = req.nextUrl.searchParams.get('item');
    const resolve = req.nextUrl.searchParams.get('resolve');

    if (!commentId || !itemId) {
      return corsJson({ error: 'Missing params' }, 400);
    }

    const item = await verifyProjectAccess(supabase, params.token, itemId);
    if (!item) {
      return corsJson({ error: 'Unauthorized' }, 403);
    }

    /* ── Resolve/unresolve (query param mode) ──────────── */
    if (resolve !== null) {
      const resolved = resolve === 'true';
      const { error } = await supabase
        .from('review_comments')
        .update({
          resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
        })
        .eq('id', commentId)
        .eq('review_item_id', itemId)
        .is('parent_comment_id', null);

      if (error) {
        console.error('Resolve error:', error);
        return corsJson({ error: 'Failed to update' }, 500);
      }

      return corsJson({ success: true, resolved });
    }

    /* ── Edit content (body mode) ──────────────────────── */
    const body = await req.json().catch(() => null);
    if (!body) return corsJson({ error: 'Invalid request body' }, 400);
    const { content, author_name, author_email } = body;

    if (!content || !content.trim()) {
      return corsJson({ error: 'Content is required' }, 400);
    }

    // Verify the comment exists and belongs to this item
    const { data: existing, error: fetchErr } = await supabase
      .from('review_comments')
      .select('id, author_name, author_email, author_type')
      .eq('id', commentId)
      .eq('review_item_id', itemId)
      .single();

    if (fetchErr || !existing) {
      return corsJson({ error: 'Comment not found' }, 404);
    }

    // Widget callers must prove authorship — match author_name + author_email.
    // Team members editing via the admin UI use authenticated routes, not this one.
    if (
      !author_name ||
      existing.author_name?.trim().toLowerCase() !== author_name.trim().toLowerCase() ||
      (existing.author_email || '').trim().toLowerCase() !== (author_email || '').trim().toLowerCase()
    ) {
      return corsJson({ error: 'You can only edit your own comments' }, 403);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update({
        content: content.trim(),
      })
      .eq('id', commentId)
      .eq('review_item_id', itemId)
      .select()
      .single();

    if (updateErr) {
      console.error('Edit error:', updateErr);
      return corsJson({ error: 'Failed to edit comment' }, 500);
    }

    return corsJson(updated);
  } catch (err) {
    console.error('PATCH error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}

/* ── DELETE — delete a comment (and its replies) ────────── */
export async function DELETE(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const commentId = req.nextUrl.searchParams.get('comment_id');
    const itemId = req.nextUrl.searchParams.get('item');

    if (!commentId || !itemId) {
      return corsJson({ error: 'Missing params' }, 400);
    }

    const item = await verifyProjectAccess(supabase, params.token, itemId);
    if (!item) {
      return corsJson({ error: 'Unauthorized' }, 403);
    }

    const authorName = req.nextUrl.searchParams.get('author_name');
    const authorEmail = req.nextUrl.searchParams.get('author_email');

    // Verify comment exists and belongs to this item
    const { data: existing, error: fetchErr } = await supabase
      .from('review_comments')
      .select('id, author_name, author_email, author_type, parent_comment_id')
      .eq('id', commentId)
      .eq('review_item_id', itemId)
      .single();

    if (fetchErr || !existing) {
      return corsJson({ error: 'Comment not found' }, 404);
    }

    // Widget callers must prove authorship before deleting.
    if (
      !authorName ||
      existing.author_name?.trim().toLowerCase() !== authorName.trim().toLowerCase() ||
      (existing.author_email || '').trim().toLowerCase() !== (authorEmail || '').trim().toLowerCase()
    ) {
      return corsJson({ error: 'You can only delete your own comments' }, 403);
    }

    // If this is a top-level comment, delete its replies first
    if (!existing.parent_comment_id) {
      await supabase
        .from('review_comments')
        .delete()
        .eq('parent_comment_id', commentId)
        .eq('review_item_id', itemId);
    }

    // Delete the comment itself
    const { error: deleteErr } = await supabase
      .from('review_comments')
      .delete()
      .eq('id', commentId)
      .eq('review_item_id', itemId);

    if (deleteErr) {
      console.error('Delete error:', deleteErr);
      return corsJson({ error: 'Failed to delete comment' }, 500);
    }

    return corsJson({ success: true, deleted: commentId });
  } catch (err) {
    console.error('DELETE error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}