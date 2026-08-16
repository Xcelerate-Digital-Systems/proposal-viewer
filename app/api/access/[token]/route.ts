import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

const REQUEST_COLUMNS = 'id, company_id, client_id, share_token, platforms, status, expires_at, client_name, client_email, notes, created_at';
const GRANT_COLUMNS = 'id, request_id, platform, status, platform_account_name, error_message, granted_at';

async function getAgencyBranding(supabase: ReturnType<typeof createServiceClient>, companyId: string) {
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('id', companyId)
    .single();

  const { data: branding } = await supabase
    .from('company_branding')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  const { data: accessConfig } = await supabase
    .from('agency_access_config')
    .select('wordpress_admin_email')
    .eq('company_id', companyId)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (branding?.logo_path) {
    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(branding.logo_path);
    logoUrl = urlData?.publicUrl ?? null;
  }

  return {
    name: company?.name ?? 'Agency',
    slug: company?.slug ?? null,
    logo_url: logoUrl,
    accent_color: branding?.accent_color ?? '#017C87',
    bg_primary: branding?.bg_primary ?? '#01434A',
    bg_secondary: branding?.bg_secondary ?? '#141414',
    font_heading: branding?.font_heading ?? null,
    font_body: branding?.font_body ?? null,
    wordpress_email: accessConfig?.wordpress_admin_email ?? null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ip = ipFromRequest(req);
  const rl = await rateLimit({
    key: `pub-access:${ip}`,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl, 30) },
    );
  }

  const supabase = createServiceClient();

  // Try per-client request token first
  const { data: request } = await supabase
    .from('client_access_requests')
    .select(REQUEST_COLUMNS)
    .eq('share_token', token)
    .single();

  if (request) {
    if (request.status === 'revoked') {
      return NextResponse.json({ error: 'This access link has been revoked' }, { status: 410 });
    }
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This access link has expired' }, { status: 410 });
    }

    const { data: grants } = await supabase
      .from('client_access_grants')
      .select(GRANT_COLUMNS)
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });

    const agency = await getAgencyBranding(supabase, request.company_id);

    return NextResponse.json({
      type: 'request',
      request: {
        id: request.id,
        platforms: request.platforms,
        status: request.status,
        client_name: request.client_name,
        notes: request.notes,
        expires_at: request.expires_at,
      },
      grants: grants ?? [],
      agency,
    });
  }

  // Try universal token
  const { data: config } = await supabase
    .from('agency_access_config')
    .select('company_id, default_platforms')
    .eq('universal_share_token', token)
    .single();

  if (!config) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const agency = await getAgencyBranding(supabase, config.company_id);

  return NextResponse.json({
    type: 'universal',
    company_id: config.company_id,
    default_platforms: config.default_platforms ?? ['meta', 'google_ga4', 'google_gtm', 'google_ads', 'wordpress'],
    agency,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ip = ipFromRequest(req);
  const rl = await rateLimit({
    key: `pub-access-register:${ip}`,
    limit: 10,
    windowSeconds: 60,
  });
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : null;
  const clientEmail = typeof body.client_email === 'string' ? body.client_email.trim() : null;
  const platforms = Array.isArray(body.platforms) ? body.platforms : null;

  if (!clientName && !clientEmail) {
    return NextResponse.json({ error: 'Name or email is required' }, { status: 400 });
  }
  if (!platforms || platforms.length === 0) {
    return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from('agency_access_config')
    .select('company_id')
    .eq('universal_share_token', token)
    .single();

  if (!config) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  // Create a request row for this client
  const { data: accessRequest, error: reqError } = await supabase
    .from('client_access_requests')
    .insert({
      company_id: config.company_id,
      platforms,
      client_name: clientName,
      client_email: clientEmail,
      status: 'pending',
    })
    .select('id, share_token')
    .single();

  if (reqError || !accessRequest) {
    console.error('[api/access/universal] create request:', reqError?.message);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }

  // Create grant rows for each platform
  const grantRows = platforms.map((platform: string) => ({
    request_id: accessRequest.id,
    platform,
    status: 'pending',
  }));

  const { error: grantError } = await supabase
    .from('client_access_grants')
    .insert(grantRows);

  if (grantError) {
    console.error('[api/access/universal] create grants:', grantError.message);
  }

  return NextResponse.json({
    share_token: accessRequest.share_token,
  });
}
