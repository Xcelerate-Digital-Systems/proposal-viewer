import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';
import {
  GUEST_VISIBLE_STAGES, isGuestVisibleStage, isInternalStage,
} from '@/lib/feedback/visibility';

// Explicit column allowlists — never SELECT * on public endpoints.
const PROJECT_COLUMNS = 'id, company_id, title, client_name, client_company, status, share_mode, shared_views, pause_new_comments, reviewer_note, reviewer_note_show, reviewer_note_updated_at, created_at, updated_at';
const ITEM_COLUMNS = 'id, review_project_id, title, type, status, sort_order, url, content:html_content, share_token, ad_platform, ad_headline, ad_primary_text:ad_copy, ad_cta, thumbnail_url:image_url, ad_creative_url, sms_content:sms_body, active_version_id, meta_data:meta_ad_variants, email_subject, email_preheader, email_body, google_ad_data, board_x, board_y, created_at, updated_at';
const COMMENT_COLUMNS = 'id, review_item_id, parent_comment_id, thread_number, author_name, author_email, author_type, content, comment_type, pin_x, pin_y, attachments, annotation_data, screenshot_url, highlight_start, highlight_end, highlight_text, highlight_element_path, resolved, resolved_by, resolved_at, priority, video_url, version_id, ad_copy_variation_id, stage_at_creation, created_at, updated_at';
const VERSION_COLUMNS = 'id, review_item_id, version_number, notes, url, content:html_content, ad_headline, ad_primary_text:ad_copy, ad_cta, thumbnail_url:image_url, sms_content:sms_body, screenshot_url, ad_creative_url, email_subject, email_preheader, email_body, created_at';

/**
 * GET /api/review/[token]
 *
 * Dual resolution: the token can be either:
 *   1. A review_items.share_token   → returns { mode: 'item', project, item, comments }
 *   2. A review_projects.share_token → returns { mode: 'project', project, items, comments, boardEdges, boardNotes }
 *
 * Item tokens are checked first (more specific), then project tokens (backward compat).
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `pub-review:${ipFromRequest(req)}`, limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 60) });
    }

    const supabase = createServiceClient();

    /* ── 1. Try item share_token first ────────────────────────── */
    const { data: item } = await supabase
      .from('review_items')
      .select(ITEM_COLUMNS)
      .eq('share_token', params.token)
      .single();

    if (item) {
      const { data: project } = await supabase
        .from('review_projects')
        .select(PROJECT_COLUMNS)
        .eq('id', item.review_project_id)
        .single();

      if (!project || project.status === 'archived') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Guests must never see an item that's currently in an internal stage,
      // even if they had a previously-shared item token. The share doesn't
      // "stick" — visibility is a function of current stage.
      if (isInternalStage(item.status)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Load comments for this single item + its versions. Strip comments
      // authored while the item was in an internal stage so internal review
      // chatter never bleeds into the guest view.
      const [commentsRes, versionsRes] = await Promise.all([
        supabase
          .from('review_comments')
          .select(COMMENT_COLUMNS)
          .eq('review_item_id', item.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('review_item_versions')
          .select(VERSION_COLUMNS)
          .eq('review_item_id', item.id)
          .order('version_number', { ascending: true }),
      ]);

      const visibleComments = (commentsRes.data ?? []).filter((c) =>
        isGuestVisibleStage((c as { stage_at_creation: string | null }).stage_at_creation),
      );

      return NextResponse.json({
        mode: 'item',
        project,
        item,
        items: [item],
        comments: visibleComments,
        itemVersions: versionsRes.data || [],
      });
    }

    /* ── 2. Fall back to project share_token ───────────────────── */
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select(PROJECT_COLUMNS)
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (project.status === 'archived') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Load items, restricted to stages that guests are allowed to see.
    // Anything in an internal stage is filtered out at the DB level so it
    // never appears in network responses to public-token requests.
    const { data: items } = await supabase
      .from('review_items')
      .select(ITEM_COLUMNS)
      .eq('review_project_id', project.id)
      .in('status', GUEST_VISIBLE_STAGES)
      .order('sort_order', { ascending: true });

    // Load comments + versions for the visible items only. Comments are
    // further filtered by `stage_at_creation` so internal-stage chatter stays
    // hidden even after an item later moves into a client-visible stage.
    const itemIds = (items || []).map((i: { id: string }) => i.id);
    let comments: unknown[] = [];
    let itemVersions: unknown[] = [];

    if (itemIds.length > 0) {
      const [commentRes, versionRes] = await Promise.all([
        supabase
          .from('review_comments')
          .select(COMMENT_COLUMNS)
          .in('review_item_id', itemIds)
          .in('stage_at_creation', GUEST_VISIBLE_STAGES)
          .order('created_at', { ascending: true }),
        supabase
          .from('review_item_versions')
          .select(VERSION_COLUMNS)
          .in('review_item_id', itemIds)
          .order('version_number', { ascending: true }),
      ]);

      comments = commentRes.data || [];
      itemVersions = versionRes.data || [];

      // Path B: include variation-scoped comments from sibling items that
      // share the same ad copy variations. These comments have
      // ad_copy_variation_id set and may live on items not in the visible
      // set (e.g. internal_review ads). We fetch them separately and remap
      // their review_item_id so useCommentFilters on the client picks them up.
      const { data: junctionLinks } = await supabase
        .from('review_item_ad_variations')
        .select('review_item_id, ad_copy_variation_id')
        .in('review_item_id', itemIds);

      if (junctionLinks && junctionLinks.length > 0) {
        const allVarIds = Array.from(new Set(junctionLinks.map((l: { ad_copy_variation_id: string }) => l.ad_copy_variation_id)));
        // Build a map: variation_id → item_ids that use it (within visible items)
        const varToItems = new Map<string, string[]>();
        for (const l of junctionLinks) {
          const arr = varToItems.get(l.ad_copy_variation_id) || [];
          arr.push(l.review_item_id);
          varToItems.set(l.ad_copy_variation_id, arr);
        }

        const existingIds = new Set((comments as { id: string }[]).map((c) => c.id));

        const { data: varComments } = await supabase
          .from('review_comments')
          .select(COMMENT_COLUMNS)
          .in('ad_copy_variation_id', allVarIds)
          .in('stage_at_creation', GUEST_VISIBLE_STAGES)
          .order('created_at', { ascending: true });

        if (varComments) {
          for (const vc of varComments) {
            if (existingIds.has(vc.id)) continue;
            // Find which visible item(s) use this variation and clone
            // the comment for each (so it appears on every ad that uses it)
            const targetItems = varToItems.get(vc.ad_copy_variation_id) || [];
            for (const targetItemId of targetItems) {
              if (targetItemId === vc.review_item_id) continue;
              (comments as unknown[]).push({
                ...vc,
                id: `${vc.id}__var_${targetItemId}`,
                review_item_id: targetItemId,
              });
            }
          }
        }
      }
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
          .select('id, review_project_id, source_item_id, source_shape_id, target_item_id, target_shape_id, source_handle, target_handle, label, edge_type, animated, style, created_at')
          .eq('review_project_id', project.id),
        supabase
          .from('review_board_notes')
          .select('id, review_project_id, content, board_x, board_y, width, height, color, font_size, created_at')
          .eq('review_project_id', project.id),
        supabase
          .from('review_board_shapes')
          .select('id, review_project_id, company_id, shape_type, x, y, width, height, end_x, end_y, content, color, stroke_width, dashed, font_size, created_at')
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