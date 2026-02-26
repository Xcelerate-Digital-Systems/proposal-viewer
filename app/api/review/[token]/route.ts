// app/api/review/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * GET /api/review/[token]
 *
 * Dual resolution: the token can be either:
 *   1. A review_items.share_token   → returns { mode: 'item', project, item, comments }
 *   2. A review_projects.share_token → returns { mode: 'project', project, items, comments, boardEdges, boardNotes }
 *
 * Item tokens are checked first (more specific), then project tokens (backward compat).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();

    /* ── 1. Try item share_token first ────────────────────────── */
    const { data: item } = await supabase
      .from('review_items')
      .select('*')
      .eq('share_token', params.token)
      .single();

    if (item) {
      // Load the parent project
      const { data: project } = await supabase
        .from('review_projects')
        .select('*')
        .eq('id', item.review_project_id)
        .single();

      if (!project || project.status === 'archived') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Load comments for this single item
      const { data: comments } = await supabase
        .from('review_comments')
        .select('*')
        .eq('review_item_id', item.id)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        mode: 'item',
        project,
        item,
        items: [item],        // Array for compatibility with existing page
        comments: comments || [],
      });
    }

    /* ── 2. Fall back to project share_token ───────────────────── */
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('*')
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (project.status === 'archived') {
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

    // Load board data if share_mode is 'board'
    let boardEdges: unknown[] = [];
    let boardNotes: unknown[] = [];

    if (project.share_mode === 'board') {
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

      boardEdges = edgesRes.data || [];
      boardNotes = notesRes.data || [];
    }

    return NextResponse.json({
      mode: 'project',
      project,
      items: items || [],
      comments,
      boardEdges,
      boardNotes,
    });
  } catch (err) {
    console.error('Review fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}