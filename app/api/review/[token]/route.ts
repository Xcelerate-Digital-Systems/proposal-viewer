// app/api/review/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();

    // Load project by share token
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('*')
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Load items
    const { data: items } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', project.id)
      .order('sort_order', { ascending: true });

    // Load all comments for all items in this project
    const itemIds = (items || []).map((i: { id: string }) => i.id);
    let comments: unknown[] = [];

    if (itemIds.length > 0) {
      const { data: commentData } = await supabase
        .from('review_comments')
        .select('*')
        .in('review_item_id', itemIds)
        .order('created_at', { ascending: true });

      comments = commentData || [];
    }

    return NextResponse.json({
      project,
      items: items || [],
      comments,
    });
  } catch (err) {
    console.error('Review fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}