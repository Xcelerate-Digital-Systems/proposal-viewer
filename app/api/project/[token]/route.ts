// app/api/project/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { GUEST_VISIBLE_STAGES } from '@/lib/feedback/visibility';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';
import { verifyShareAuthCookie } from '@/lib/feedback/share-password';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

const PROJECT_COLUMNS = 'id, company_id, title, client_name, client_company, status, project_type, share_mode, shared_views, pause_new_comments, reviewer_note, reviewer_note_show, reviewer_note_updated_at, share_password_hash, share_expires_at, created_at, updated_at';

/**
 * GET /api/project/[token]
 *
 * Public route: loads a feedback project and all its items for the card grid view.
 * Token is the review_projects.share_token.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `pub-project:${ipFromRequest(req)}`, limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 60) });
    }

    const supabase = createServiceClient();

    // Load project by share token — explicit column list, never SELECT *
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select(PROJECT_COLUMNS)
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Don't expose archived projects publicly
    if (project.status === 'archived') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── Expiry check ──
    if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
      return NextResponse.json({ error: 'expired', expired: true }, { status: 410 });
    }

    // ── Password check ──
    if (project.share_password_hash) {
      const cookie = req.cookies.get(`av_share_auth_${params.token}`)?.value;
      const verified = cookie ? verifyShareAuthCookie(cookie) : null;
      if (!verified || verified.token !== params.token) {
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

    // Strip sensitive fields
    const { share_password_hash: _ph, share_expires_at: _ex, ...safeProject } = project as Record<string, unknown>;

    const response = NextResponse.json({
      project: safeProject,
      items: items || [],
      comments,
    });

    // Prevent browser and CDN caching — always return fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return response;
  } catch (err) {
    console.error('Project grid fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
