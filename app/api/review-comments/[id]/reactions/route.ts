// app/api/review-comments/[id]/reactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verify the caller is allowed to interact with reactions on this comment.
 *
 * Admin path: Authorization header present → getAuthContext, then verify the
 * comment's company_id matches the caller's companyId.
 *
 * Public path: share_token query param → look up the comment's review_item_id,
 * then verify the review item belongs to a review_project with that share_token.
 */
async function authoriseReactionAccess(req: NextRequest, commentId: string) {
  const supabase = createServiceClient();
  const hasAuthHeader = !!req.headers.get('authorization');
  const shareToken = req.nextUrl.searchParams.get('share_token');

  if (!hasAuthHeader && !shareToken) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Load the comment (needed for both paths)
  const { data: comment, error: commentErr } = await supabase
    .from('review_comments')
    .select('id, company_id, review_item_id')
    .eq('id', commentId)
    .single();

  if (commentErr || !comment) {
    return { error: NextResponse.json({ error: 'Comment not found' }, { status: 404 }) };
  }

  if (hasAuthHeader) {
    // Admin path — verify auth + company ownership
    const auth = await getAuthContext(req);
    if (!auth) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (!auth.member.is_super_admin && comment.company_id !== auth.companyId) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { supabase, comment };
  }

  // Public path — verify share_token matches the comment's review project
  const { data: item } = await supabase
    .from('review_items')
    .select('id, project_id')
    .eq('id', comment.review_item_id)
    .single();

  if (!item) {
    return { error: NextResponse.json({ error: 'Review item not found' }, { status: 404 }) };
  }

  const { data: project } = await supabase
    .from('review_projects')
    .select('id')
    .eq('id', item.project_id)
    .eq('share_token', shareToken)
    .maybeSingle();

  if (!project) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, comment };
}

/**
 * GET /api/review-comments/[id]/reactions
 * Fetch all reactions for a comment.
 */
export async function GET(req: NextRequest, props: RouteContext) {
  const params = await props.params;

  const ctx = await authoriseReactionAccess(req, params.id);
  if ('error' in ctx) return ctx.error;
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from('review_comment_reactions')
    .select('*')
    .eq('review_comment_id', params.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Reactions fetch error:', error);
    return NextResponse.json({ error: 'Failed to load reactions' }, { status: 500 });
  }

  return NextResponse.json({ reactions: data || [] });
}

/**
 * POST /api/review-comments/[id]/reactions
 * Toggle a reaction (add if missing, remove if exists).
 *
 * Body: { emoji, author_name, author_user_id? }
 */
export async function POST(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await authoriseReactionAccess(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { emoji, author_name, author_user_id } = body;
    if (!emoji || !author_name) {
      return NextResponse.json({ error: 'Missing emoji or author_name' }, { status: 400 });
    }

    // Check for existing reaction by this user on this comment+emoji
    const matchFilter = supabase
      .from('review_comment_reactions')
      .select('id')
      .eq('review_comment_id', params.id)
      .eq('emoji', emoji);

    // Match by user_id if available, otherwise by name
    if (author_user_id) {
      matchFilter.eq('author_user_id', author_user_id);
    } else {
      matchFilter.eq('author_name', author_name);
    }

    const { data: existing } = await matchFilter.limit(1);

    if (existing && existing.length > 0) {
      // Remove existing reaction (toggle off)
      await supabase
        .from('review_comment_reactions')
        .delete()
        .eq('id', existing[0].id);

      return NextResponse.json({ action: 'removed', id: existing[0].id });
    }

    // Add new reaction
    const { data: reaction, error: insertErr } = await supabase
      .from('review_comment_reactions')
      .insert({
        review_comment_id: params.id,
        emoji,
        author_name,
        author_user_id: author_user_id || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Reaction insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 });
    }

    return NextResponse.json({ action: 'added', reaction });
  } catch (err) {
    console.error('Reaction API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
