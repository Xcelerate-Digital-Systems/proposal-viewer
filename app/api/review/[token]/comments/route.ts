// app/api/review/[token]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

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
      parent_comment_id,
    } = body;

    if (!review_item_id || !author_name || !content || !comment_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the item belongs to this share token's project
    const { data: item, error: itemErr } = await supabase
      .from('review_items')
      .select('id, company_id, review_project_id')
      .eq('id', review_item_id)
      .single();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, share_token')
      .eq('id', item.review_project_id)
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Determine thread_number for new top-level comments
    let thread_number: number | null = null;
    if (!parent_comment_id && (comment_type === 'pin' || comment_type === 'text_highlight')) {
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
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Comment insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
    }

    return NextResponse.json(comment);
  } catch (err) {
    console.error('Comment API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}