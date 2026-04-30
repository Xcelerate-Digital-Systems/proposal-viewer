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

      // Load comments for this single item + its versions
      const [commentsRes, versionsRes] = await Promise.all([
        supabase
          .from('review_comments')
          .select('*')
          .eq('review_item_id', item.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('review_item_versions')
          .select('*')
          .eq('review_item_id', item.id)
          .order('version_number', { ascending: true }),
      ]);

      return NextResponse.json({
        mode: 'item',
        project,
        item,
        items: [item],
        comments: commentsRes.data || [],
        itemVersions: versionsRes.data || [],
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

    // Load all comments + all versions for every item in this project
    const itemIds = (items || []).map((i: { id: string }) => i.id);
    let comments: unknown[] = [];
    let itemVersions: unknown[] = [];

    if (itemIds.length > 0) {
      const [commentRes, versionRes] = await Promise.all([
        supabase
          .from('review_comments')
          .select('*')
          .in('review_item_id', itemIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('review_item_versions')
          .select('*')
          .in('review_item_id', itemIds)
          .order('version_number', { ascending: true }),
      ]);

      comments = commentRes.data || [];
      itemVersions = versionRes.data || [];
    }

    // Load board data whenever the board tab is shared (or when share_mode
    // legacy flag indicates board). Fetched up front so the tabbed viewer
    // can switch tabs without an extra round trip.
    const sharedViews = (project.shared_views as { board?: boolean } | null) ?? null;
    const wantsBoard = sharedViews?.board === true || project.share_mode === 'board';

    let boardEdges: unknown[] = [];
    let boardNotes: unknown[] = [];
    let boardShapes: unknown[] = [];

    if (wantsBoard) {
      const [edgesRes, notesRes, shapesRes] = await Promise.all([
        supabase
          .from('review_board_edges')
          .select('*')
          .eq('review_project_id', project.id),
        supabase
          .from('review_board_notes')
          .select('*')
          .eq('review_project_id', project.id),
        supabase
          .from('review_board_shapes')
          .select('*')
          .eq('review_project_id', project.id),
      ]);

      boardEdges = edgesRes.data || [];
      boardNotes = notesRes.data || [];
      // review_board_shapes may not exist in older DB snapshots — tolerate.
      boardShapes = shapesRes.error ? [] : (shapesRes.data || []);
    }

    return NextResponse.json({
      mode: 'project',
      project,
      items: items || [],
      comments,
      itemVersions,
      boardEdges,
      boardNotes,
      boardShapes,
    });
  } catch (err) {
    console.error('Review fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}