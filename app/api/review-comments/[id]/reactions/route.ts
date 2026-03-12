// app/api/review-comments/[id]/reactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * GET /api/review-comments/[id]/reactions
 * Fetch all reactions for a comment.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

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
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

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
