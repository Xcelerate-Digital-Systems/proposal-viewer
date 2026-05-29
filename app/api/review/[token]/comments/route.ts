import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isValidHttpUrl } from '@/lib/sanitize';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Fire-and-forget notification dispatch. We resolve the parent project's
 * share_token (in case the request came in via an item-level token) and
 * pass it to /api/review-notify, which gathers participants and emails.
 */
async function notifyParticipantsAsync(params: {
  review_item_id: string;
  review_comment_id: string;
  itemProjectId: string;
  author_name: string;
  author_email?: string | null;
  content: string;
  parent_comment_id: string | null;
}) {
  try {
    const supabase = createServiceClient();
    const { data: project } = await supabase
      .from('review_projects')
      .select('share_token')
      .eq('id', params.itemProjectId)
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
        comment_author_email: params.author_email ?? null,
        comment_content: params.content,
        item_title: item?.title ?? null,
        parent_comment_id: params.parent_comment_id,
        author_type: 'client',
      }),
    });
  } catch (err) {
    console.error('Failed to dispatch review notification:', err);
  }
}

/**
 * POST /api/review/[token]/comments
 *
 * Post a comment on a feedback item. Token can be either:
 *   - A review_projects.share_token (project-level sharing)
 *   - A review_items.share_token (item-level sharing)
 *
 * Both are validated to ensure the commenter has legitimate access.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `review:comments:${params.token}`, limit: 30, windowSeconds: 60 });
    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = createServiceClient();
    const body = await req.json();

    const {
      review_item_id,
      author_name,
      author_email,
      content,
      comment_type,
      pin_x,
      pin_y,
      parent_comment_id,
      attachments,
      annotation_data,
      screenshot_url,
      highlight_start,
      highlight_end,
      highlight_text,
      highlight_element_path,
      version_id,
      priority,
      video_url,
    } = body;

    const VALID_PRIORITIES = ['high', 'medium', 'low', 'none'] as const;
    type Priority = typeof VALID_PRIORITIES[number];
    const safePriority: Priority = VALID_PRIORITIES.includes(priority) ? priority : 'none';

    if (!review_item_id || !author_name || !content || !comment_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load the item
    const { data: item, error: itemErr } = await supabase
      .from('review_items')
      .select('id, company_id, review_project_id, share_token')
      .eq('id', review_item_id)
      .single();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // ── Validate token access ──────────────────────────────────
    // Check 1: Does the token match this item's own share_token?
    let authorized = item.share_token === params.token;

    // Check 2: Does the token match the parent project's share_token?
    if (!authorized) {
      const { data: project } = await supabase
        .from('review_projects')
        .select('id, share_token')
        .eq('id', item.review_project_id)
        .eq('share_token', params.token)
        .single();

      authorized = !!project;
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Determine thread_number for new top-level annotated comments
    const NUMBERED_TYPES = ['pin', 'box', 'text', 'screenshot', 'text_highlight'];
    let thread_number: number | null = null;
    if (!parent_comment_id && NUMBERED_TYPES.includes(comment_type)) {
      const { data: nextNum } = await supabase.rpc('claim_next_thread_number', {
        p_review_item_id: review_item_id,
      });
      thread_number = nextNum ?? 1;
    }

    // Validate URL fields — reject anything that isn't http(s).
    const safeScreenshotUrl =
      typeof screenshot_url === 'string' && isValidHttpUrl(screenshot_url) ? screenshot_url : null;
    const safeVideoUrl =
      typeof video_url === 'string' && isValidHttpUrl(video_url) ? video_url : null;

    // Validate version_id if supplied — must belong to this item, else null.
    let safeVersionId: string | null = null;
    if (version_id && typeof version_id === 'string') {
      const { data: v } = await supabase
        .from('review_item_versions')
        .select('id')
        .eq('id', version_id)
        .eq('review_item_id', review_item_id)
        .maybeSingle();
      safeVersionId = v?.id ?? null;
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
        attachments: attachments || [],
        annotation_data: annotation_data || null,
        screenshot_url: safeScreenshotUrl,
        highlight_start: highlight_start ?? null,
        highlight_end: highlight_end ?? null,
        highlight_text: highlight_text ?? null,
        highlight_element_path: highlight_element_path ?? null,
        priority: safePriority,
        video_url: safeVideoUrl,
        version_id: safeVersionId,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Comment insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
    }

    // Fire participant notifications (top-level + reply). Resolve the
    // project share token so /api/review-notify can locate the project even
    // if the public URL was an item-level token.
    void notifyParticipantsAsync({
      review_item_id,
      review_comment_id: comment.id,
      itemProjectId: item.review_project_id,
      author_name,
      author_email,
      content,
      parent_comment_id: parent_comment_id || null,
    });

    return NextResponse.json(comment);
  } catch (err) {
    console.error('Comment API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Verify the share token authorizes access to the item, then verify the
 * caller's identity (email when the comment has one, name otherwise) matches
 * the comment's author. Returns the comment row when authorized, or a
 * NextResponse with the error otherwise.
 *
 * Guest identity is honor-system (anyone with the share token who knows the
 * email/name can pose as the author). That matches the existing trust model
 * for the public reviewer.
 */
async function loadOwnedComment(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
  commentId: string,
  identity: { author_email?: string | null; author_name?: string | null }
) {
  const { data: comment, error: cErr } = await supabase
    .from('review_comments')
    .select('id, review_item_id, author_name, author_email, author_type, parent_comment_id')
    .eq('id', commentId)
    .single();
  if (cErr || !comment) {
    return { error: NextResponse.json({ error: 'Comment not found' }, { status: 404 }) };
  }

  const { data: item } = await supabase
    .from('review_items')
    .select('id, review_project_id, share_token')
    .eq('id', comment.review_item_id)
    .single();
  if (!item) {
    return { error: NextResponse.json({ error: 'Item not found' }, { status: 404 }) };
  }

  let authorized = item.share_token === token;
  if (!authorized) {
    const { data: project } = await supabase
      .from('review_projects')
      .select('id')
      .eq('id', item.review_project_id)
      .eq('share_token', token)
      .single();
    authorized = !!project;
  }
  if (!authorized) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }

  // Guests can only modify comments they authored. Team-authored comments
  // are admin-only (admin path uses /api/review-comments/[id]).
  if (comment.author_type !== 'client') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const callerEmail = identity.author_email?.trim().toLowerCase() || null;
  const callerName = identity.author_name?.trim() || null;
  const commentEmail = comment.author_email?.trim().toLowerCase() || null;
  const commentName = comment.author_name?.trim() || null;

  const matches = commentEmail
    ? !!callerEmail && callerEmail === commentEmail
    : !!callerName && callerName === commentName;

  if (!matches) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { comment };
}

/**
 * PATCH /api/review/[token]/comments
 *
 * Body: { comment_id, content, author_email?, author_name? }
 * Guests can edit their own comments only.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { comment_id, content, author_email, author_name } = body ?? {};

    if (!comment_id || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const owned = await loadOwnedComment(supabase, params.token, comment_id, { author_email, author_name });
    if ('error' in owned) return owned.error;

    const trimmed = content.trim();
    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update({ content: trimmed })
      .eq('id', comment_id)
      .select()
      .single();

    if (updateErr) {
      console.error('Edit error:', updateErr);
      return NextResponse.json({ error: 'Failed to edit comment' }, { status: 500 });
    }

    // Resync @mentions for the new content (guests can mention too). No
    // additional notification fires on edit — matches Filestage parity.
    try {
      const { syncCommentMentions } = await import('@/lib/feedback/persist-mentions');
      await syncCommentMentions(supabase, {
        commentId: comment_id,
        content: trimmed,
        projectId: null,
        actorEmail: typeof author_email === 'string' ? author_email : null,
      });
    } catch (err) {
      console.error('Failed to resync mentions on edit:', err);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Comment PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/review/[token]/comments?comment_id=...&author_email=...&author_name=...
 *
 * Guests can delete their own comments only. Cascades to replies when the
 * target is a top-level comment.
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const url = req.nextUrl;
    const comment_id = url.searchParams.get('comment_id');
    const author_email = url.searchParams.get('author_email');
    const author_name = url.searchParams.get('author_name');

    if (!comment_id) {
      return NextResponse.json({ error: 'Missing comment_id' }, { status: 400 });
    }

    const owned = await loadOwnedComment(supabase, params.token, comment_id, { author_email, author_name });
    if ('error' in owned) return owned.error;

    // Top-level → cascade replies first.
    if (!owned.comment.parent_comment_id) {
      await supabase
        .from('review_comments')
        .delete()
        .eq('parent_comment_id', comment_id);
    }

    const { error: deleteErr } = await supabase
      .from('review_comments')
      .delete()
      .eq('id', comment_id);

    if (deleteErr) {
      console.error('Delete error:', deleteErr);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: comment_id });
  } catch (err) {
    console.error('Comment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}