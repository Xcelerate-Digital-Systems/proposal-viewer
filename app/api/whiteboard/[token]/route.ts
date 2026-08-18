// app/api/whiteboard/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { GUEST_VISIBLE_STAGES } from '@/lib/feedback/visibility';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';
import { verifyShareAuthCookie } from '@/lib/feedback/share-password';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/whiteboard/[token]
 *
 * Public route: loads a feedback project, items, and board data for the
 * whiteboard canvas view.
 * Token is the review_projects.board_share_token.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `pub-whiteboard:${ipFromRequest(req)}`, limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 60) });
    }

    const supabase = createServiceClient();

    // Load project by board_share_token — check auth gates before returning data
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, company_id, title, client_name, client_company, status, project_type, share_mode, shared_views, pause_new_comments, reviewer_note, reviewer_note_show, reviewer_note_updated_at, share_password_hash, share_expires_at, board_share_token, created_at, updated_at')
      .eq('board_share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (project.status === 'archived') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── Expiry check ──
    if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
      return NextResponse.json({ error: 'expired', expired: true }, { status: 410 });
    }

    // ── Password check (uses the main share_token cookie since password is project-level) ──
    if (project.share_password_hash) {
      const shareToken = project.board_share_token;
      const cookie = req.cookies.get(`av_share_auth_${shareToken}`)?.value;
      const verified = cookie ? verifyShareAuthCookie(cookie) : null;
      if (!verified || verified.token !== shareToken) {
        return NextResponse.json({ error: 'password_required', passwordRequired: true }, { status: 401 });
      }
    }

    // Load items restricted to guest-visible stages
    const { data: items } = await supabase
      .from('review_items')
      .select('id, review_project_id, title, type, status, sort_order, url, html_content, ad_platform, ad_headline, ad_copy, ad_cta, image_url, ad_creative_url, sms_body, active_version_id, meta_ad_variants, email_subject, email_preheader, email_body, google_ad_data, board_x, board_y, board_color, page_path, parent_item_id, figma_file_key, figma_frame_name, created_at, updated_at')
      .eq('review_project_id', project.id)
      .in('status', GUEST_VISIBLE_STAGES)
      .order('sort_order', { ascending: true });

    // Comments filtered by stage_at_creation
    const itemIds = (items || []).map((i: { id: string }) => i.id);
    let comments: unknown[] = [];

    if (itemIds.length > 0) {
      const { data: commentData } = await supabase
        .from('review_comments')
        .select('id, review_item_id, parent_comment_id, thread_number, author_name, author_email, author_type, content, comment_type, pin_x, pin_y, attachments, annotation_data, screenshot_url, highlight_start, highlight_end, highlight_text, highlight_element_path, resolved, resolved_by, resolved_at, priority, video_url, version_id, ad_copy_variation_id, stage_at_creation, created_at, updated_at')
        .in('review_item_id', itemIds)
        .in('stage_at_creation', GUEST_VISIBLE_STAGES)
        .order('created_at', { ascending: true });

      comments = commentData || [];
    }

    // Board edges, notes, shapes — no stage filtering needed
    const [{ data: boardEdges }, { data: boardNotes }, { data: boardShapes }] = await Promise.all([
      supabase
        .from('review_board_edges')
        .select('id, review_project_id, source_item_id, target_item_id, edge_type, label, color, animated, created_at')
        .eq('review_project_id', project.id),
      supabase
        .from('review_board_notes')
        .select('id, review_project_id, content, board_x, board_y, width, height, color, font_size, created_at, updated_at')
        .eq('review_project_id', project.id),
      supabase
        .from('review_board_shapes')
        .select('id, review_project_id, shape_type, board_x, board_y, width, height, color, opacity, rotation, label, created_at, updated_at')
        .eq('review_project_id', project.id),
    ]);

    // Strip sensitive fields from project
    const { share_password_hash: _ph, share_expires_at: _ex, board_share_token: _bt, company_id: _cid, ...safeProject } = project as Record<string, unknown>;

    const response = NextResponse.json({
      project: safeProject,
      items: items || [],
      comments,
      boardEdges: boardEdges || [],
      boardNotes: boardNotes || [],
      boardShapes: boardShapes || [],
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return response;
  } catch (err) {
    console.error('Whiteboard fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
