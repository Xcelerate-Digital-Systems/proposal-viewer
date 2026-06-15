import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';

const PROJECT_COLUMNS = 'id, company_id, title, description, client_name, client_company, status';

const ITEM_COLUMNS = [
  'id', 'title', 'type', 'status', 'sort_order', 'url',
  'ad_headline', 'ad_copy', 'ad_cta', 'ad_creative_url', 'ad_platform',
  'meta_ad_variants',
  'email_subject', 'email_preheader', 'email_body',
  'sms_body',
  'image_url', 'video_url', 'pdf_url',
  'google_ad_data',
].join(', ');

/**
 * GET /api/handoff/[token]
 *
 * Public endpoint — returns campaign + approved items for the handoff page.
 * No authentication required; gated by the handoff_share_token.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;

  try {
    const rl = await rateLimit({
      key: `pub-handoff:${ipFromRequest(req)}`,
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl, 60) },
      );
    }

    const supabase = createServiceClient();

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select(PROJECT_COLUMNS)
      .eq('handoff_share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: items } = await supabase
      .from('review_items')
      .select(ITEM_COLUMNS)
      .eq('review_project_id', project.id)
      .eq('status', 'approved')
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      project,
      items: items || [],
    });
  } catch (err) {
    console.error('Handoff fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
