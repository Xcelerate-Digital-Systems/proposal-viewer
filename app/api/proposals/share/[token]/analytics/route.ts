import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ANALYTICS_LIMIT = 30;
const ANALYTICS_WINDOW = 60;

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> },
) {
  const { token } = await props.params;

  const rl = await rateLimit({
    key: `analytics:${token}:${ipFromRequest(req)}`,
    limit: ANALYTICS_LIMIT,
    windowSeconds: ANALYTICS_WINDOW,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl, ANALYTICS_LIMIT) },
    );
  }

  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, company_id, status')
    .eq('share_token', token)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only track analytics once the proposal has been sent to the client.
  // Draft views are the agency owner previewing — exclude those.
  if (proposal.status === 'draft') {
    return NextResponse.json({ skipped: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event as string;
  const viewId = body.view_id as string | undefined;

  if (event === 'view_start') {
    const ua = req.headers.get('user-agent') || '';
    const isMobile = /mobile|android|iphone/i.test(ua);
    const isTablet = /tablet|ipad/i.test(ua);
    const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    const { data, error } = await supabase
      .from('proposal_views')
      .insert({
        proposal_id: proposal.id,
        company_id: proposal.company_id,
        share_token: token,
        viewer_email: typeof body.viewer_email === 'string' ? body.viewer_email.slice(0, 200) : null,
        viewer_name: typeof body.viewer_name === 'string' ? body.viewer_name.slice(0, 200) : null,
        viewer_ip: ipFromRequest(req),
        user_agent: ua.slice(0, 500),
        device_type: deviceType,
        referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[analytics] insert error:', error);
      return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
    }

    return NextResponse.json({ view_id: data.id });
  }

  if (event === 'heartbeat' && viewId) {
    const updates: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
    };

    if (typeof body.pages_viewed === 'number') {
      updates.pages_viewed = Math.min(body.pages_viewed as number, 200);
    }
    if (typeof body.total_time_seconds === 'number') {
      updates.total_time_seconds = Math.min(body.total_time_seconds as number, 86400);
    }
    if (typeof body.page_times === 'object' && body.page_times !== null) {
      updates.page_times = body.page_times;
    }
    if (typeof body.max_scroll_depth === 'number') {
      updates.max_scroll_depth = Math.min(body.max_scroll_depth as number, 1);
    }

    await supabase
      .from('proposal_views')
      .update(updates)
      .eq('id', viewId)
      .eq('proposal_id', proposal.id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
}
