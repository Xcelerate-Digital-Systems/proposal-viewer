// app/api/review-widget/[token]/reactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isGuestVisibleStage } from '@/lib/feedback/visibility';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function commentBelongsToProject(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
  commentId: string
) {
  const { data: comment } = await supabase
    .from('review_comments')
    .select('id, review_item_id')
    .eq('id', commentId)
    .single();
  if (!comment) return null;

  const { data: item } = await supabase
    .from('review_items')
    .select('id, review_project_id, status')
    .eq('id', comment.review_item_id)
    .single();
  if (!item) return null;
  // Guests can't react on items in internal stages, even with a comment ID.
  if (!isGuestVisibleStage(item.status)) return null;

  const { data: project } = await supabase
    .from('review_projects')
    .select('id')
    .eq('id', item.review_project_id)
    .eq('share_token', token)
    .single();
  if (!project) return null;

  return comment;
}

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const itemId = req.nextUrl.searchParams.get('item');
    if (!itemId) return corsJson({ error: 'Missing item param' }, 400);

    const { data: item } = await supabase
      .from('review_items')
      .select('id, review_project_id, status')
      .eq('id', itemId)
      .single();
    if (!item) return corsJson({ error: 'Unauthorized' }, 403);
    if (!isGuestVisibleStage(item.status)) return corsJson({ error: 'Unauthorized' }, 403);

    const { data: project } = await supabase
      .from('review_projects')
      .select('id')
      .eq('id', item.review_project_id)
      .eq('share_token', params.token)
      .single();
    if (!project) return corsJson({ error: 'Unauthorized' }, 403);

    const { data: comments } = await supabase
      .from('review_comments')
      .select('id')
      .eq('review_item_id', itemId);
    const ids = (comments || []).map((c) => c.id);
    if (ids.length === 0) return corsJson({ reactions: [] });

    const { data: reactions, error } = await supabase
      .from('review_comment_reactions')
      .select('*')
      .in('review_comment_id', ids)
      .order('created_at', { ascending: true });
    if (error) return corsJson({ error: 'Failed to load reactions' }, 500);

    return corsJson({ reactions: reactions || [] });
  } catch (err) {
    console.error('Widget reactions GET error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { comment_id, emoji, author_name } = body || {};
    if (!comment_id || !emoji || !author_name) {
      return corsJson({ error: 'Missing comment_id, emoji or author_name' }, 400);
    }

    const comment = await commentBelongsToProject(supabase, params.token, comment_id);
    if (!comment) return corsJson({ error: 'Unauthorized' }, 403);

    const { data: existing } = await supabase
      .from('review_comment_reactions')
      .select('id')
      .eq('review_comment_id', comment_id)
      .eq('emoji', emoji)
      .eq('author_name', author_name)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('review_comment_reactions')
        .delete()
        .eq('id', existing[0].id);
      return corsJson({ action: 'removed', id: existing[0].id });
    }

    const { data: reaction, error: insertErr } = await supabase
      .from('review_comment_reactions')
      .insert({
        review_comment_id: comment_id,
        emoji,
        author_name,
        author_user_id: null,
      })
      .select()
      .single();
    if (insertErr) return corsJson({ error: 'Failed to add reaction' }, 500);

    return corsJson({ action: 'added', reaction });
  } catch (err) {
    console.error('Widget reactions POST error:', err);
    return corsJson({ error: 'Internal server error' }, 500);
  }
}
