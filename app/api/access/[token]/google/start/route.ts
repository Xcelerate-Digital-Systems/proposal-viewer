import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { buildGoogleAuthorizeUrl, getScopesForPlatform } from '@/lib/connectors/google/api-client';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import type { AccessPlatform } from '@/lib/client-access/types';

export const dynamic = 'force-dynamic';

const STATE_TTL_SECONDS = 600;
const GOOGLE_PLATFORMS: AccessPlatform[] = ['google_ga4', 'google_gtm', 'google_ads'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ip = ipFromRequest(req);
  const rl = await rateLimit({ key: `pub-access-google:${ip}`, limit: 10, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl, 10) },
    );
  }

  const platform = req.nextUrl.searchParams.get('platform') as AccessPlatform | null;
  if (!platform || !GOOGLE_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform parameter' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!clientId || !appUrl) {
    return NextResponse.json({ error: 'Google connector is not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from('client_access_requests')
    .select('id, company_id, status, expires_at')
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
    .eq('platform', platform)
    .single();

  if (!grant) {
    return NextResponse.json({ error: `${platform} not requested` }, { status: 400 });
  }

  if (grant.status === 'granted' || grant.status === 'request_sent') {
    return NextResponse.json({ error: `${platform} is already connected` }, { status: 400 });
  }

  const state = randomBytes(32).toString('base64url');
  const stateHash = createHash('sha256').update(state).digest('hex');
  const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();

  const { error: stateError } = await supabase
    .from('client_access_oauth_states')
    .insert({
      state_hash: stateHash,
      access_request_id: request.id,
      grant_id: grant.id,
      platform,
      redirect_token: token,
      expires_at: expiresAt,
    });

  if (stateError) {
    console.error('[api/access/google/start]', stateError.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const scopes = getScopesForPlatform(platform);

  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    scopes,
  });

  return NextResponse.redirect(authorizeUrl);
}
