// app/api/review-widget/[token]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/* ── Preflight ──────────────────────────────────────────── */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ── Helpers ────────────────────────────────────────────── */
async function verifyProjectAccess(supabase: ReturnType<typeof createServiceClient>, token: string, itemId: string) {
  const { data: item, error: itemErr } = await supabase
    .from('review_items')
    .select('id, company_id, review_project_id')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) return null;

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
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
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

    const { data: comments, error } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Comments fetch error:', error);
      return corsJson({ error: 'Failed to load comments' }, 500);
    }

    return corsJson({ comments: comments || [] });
  } catch (err) {
    console.error('Comments GET error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}

/* ── POST — create a comment ────────────────────────────── */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
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
      pin_element_path,
      parent_comment_id,
      screenshot_url,
      annotation_data,
    } = body;

    if (!review_item_id || !author_name || !content || !comment_type) {
      return corsJson({ error: 'Missing required fields' }, 400);
    }

    const item = await verifyProjectAccess(supabase, params.token, review_item_id);
    if (!item) {
      return corsJson({ error: 'Unauthorized' }, 403);
    }

    // Determine thread_number for new top-level annotated comments
    const NUMBERED_TYPES = ['pin', 'box', 'text', 'screenshot'];
    let thread_number: number | null = null;
    if (!parent_comment_id && NUMBERED_TYPES.includes(comment_type)) {
      const { data: existing } = await supabase
        .from('review_comments')
        .select('thread_number')
        .eq('review_item_id', review_item_id)
        .is('parent_comment_id', null)
        .not('thread_number', 'is', null)
        .order('thread_number', { ascending: false })
        .limit(1);

      thread_number = (existing?.[0]?.thread_number ?? 0) + 1;
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
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Comment insert error:', insertErr);
      return corsJson({ error: 'Failed to post comment' }, 500);
    }

    return corsJson(comment);
  } catch (err) {
    console.error('Comment POST error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}

/* ── PATCH — resolve/unresolve OR edit comment content ─── */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
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
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return corsJson({ error: 'Content is required' }, 400);
    }

    // Verify the comment exists and belongs to this item
    const { data: existing, error: fetchErr } = await supabase
      .from('review_comments')
      .select('id, author_name, author_type')
      .eq('id', commentId)
      .eq('review_item_id', itemId)
      .single();

    if (fetchErr || !existing) {
      return corsJson({ error: 'Comment not found' }, 404);
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
export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
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

    // Verify comment exists and belongs to this item
    const { data: existing, error: fetchErr } = await supabase
      .from('review_comments')
      .select('id, author_name, author_type, parent_comment_id')
      .eq('id', commentId)
      .eq('review_item_id', itemId)
      .single();

    if (fetchErr || !existing) {
      return corsJson({ error: 'Comment not found' }, 404);
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