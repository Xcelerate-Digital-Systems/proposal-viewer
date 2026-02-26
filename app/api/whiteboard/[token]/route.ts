// app/api/whiteboard/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * GET /api/whiteboard/[token]
 *
 * Public route: loads a review project, items, and board data for the
 * whiteboard canvas view.
 * Token is the review_projects.board_share_token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();

    // Load project by board_share_token
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('*')
      .eq('board_share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Don't expose archived projects publicly
    if (project.status === 'archived') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Load all items (needed for board node rendering)
    const { data: items } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', project.id)
      .order('sort_order', { ascending: true });

    // Load board edges and notes
    const [edgesRes, notesRes] = await Promise.all([
      supabase
        .from('review_board_edges')
        .select('*')
        .eq('review_project_id', project.id),
      supabase
        .from('review_board_notes')
        .select('*')
        .eq('review_project_id', project.id),
    ]);

    // Load comments (for comment badges on board nodes)
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
      boardEdges: edgesRes.data || [],
      boardNotes: notesRes.data || [],
    });
  } catch (err) {
    console.error('Whiteboard fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}