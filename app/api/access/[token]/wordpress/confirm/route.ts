import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { notifyAccessCompletion } from '@/lib/client-access/notify-completion';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ip = ipFromRequest(req);
  const rl = await rateLimit({ key: `pub-access-wp:${ip}`, limit: 10, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl, 10) },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const wpSiteUrl = typeof body?.wp_site_url === 'string' ? body.wp_site_url.trim() : null;

  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from('client_access_requests')
    .select('id, status, expires_at')
    .eq('share_token', token)
    .single();

  if (!request) {
    return NextResponse.json({ error: 'Invalid access link' }, { status: 404 });
  }

  if (request.status === 'revoked') {
    return NextResponse.json({ error: 'This access link has been revoked' }, { status: 410 });
  }

  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This access link has expired' }, { status: 410 });
  }

  const { data: grant } = await supabase
    .from('client_access_grants')
    .select('id, status')
    .eq('request_id', request.id)
    .eq('platform', 'wordpress')
    .single();

  if (!grant) {
    return NextResponse.json({ error: 'WordPress not requested' }, { status: 400 });
  }

  if (grant.status === 'self_reported' || grant.status === 'granted') {
    return NextResponse.json({ error: 'WordPress already confirmed' }, { status: 400 });
  }

  await supabase
    .from('client_access_grants')
    .update({
      status: 'self_reported',
      platform_account_name: wpSiteUrl || null,
      metadata: { wp_site_url: wpSiteUrl, confirmed_by_client: true },
      granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', grant.id);

  // Update request status
  const { data: allGrants } = await supabase
    .from('client_access_grants')
    .select('status')
    .eq('request_id', request.id);

  const allDone = (allGrants ?? []).every(
    (g) => g.status === 'granted' || g.status === 'request_sent' || g.status === 'self_reported',
  );

  await supabase
    .from('client_access_requests')
    .update({
      status: allDone ? 'complete' : 'partial',
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  if (allDone) {
    const { data: reqForNotify } = await supabase
      .from('client_access_requests')
      .select('company_id')
      .eq('id', request.id)
      .single();
    if (reqForNotify) {
      notifyAccessCompletion({ requestId: request.id, companyId: reqForNotify.company_id })
        .catch((err) => console.error('[wp-confirm] completion notify error:', err));
    }
  }

  return NextResponse.json({ success: true });
}
