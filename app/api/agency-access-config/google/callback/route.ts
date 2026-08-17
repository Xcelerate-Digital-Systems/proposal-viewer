import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { exchangeGoogleCode } from '@/lib/connectors/google/api-client';
import { encryptToken } from '@/lib/connectors/google/token-crypto';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function settingsRedirect(appUrl: string, query: Record<string, string>) {
  const url = new URL(`${appUrl}/client-access`);
  url.searchParams.set('tab', 'settings');
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit({ key: `agency-google-cb:${ipFromRequest(req)}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 20) });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!appUrl || !clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google connector not configured' }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;

  if (params.get('error')) {
    return settingsRedirect(appUrl, { google_error: 'denied' });
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return settingsRedirect(appUrl, { google_error: 'missing_code' });
  }

  const supabase = createServiceClient();
  const stateHash = createHash('sha256').update(state).digest('hex');

  const { data: stateRow } = await supabase
    .from('meta_oauth_states')
    .select('company_id, user_id, expires_at, consumed_at')
    .eq('state_hash', stateHash)
    .single();

  if (!stateRow) return settingsRedirect(appUrl, { google_error: 'invalid_state' });
  if (stateRow.consumed_at) return settingsRedirect(appUrl, { google_error: 'state_used' });
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return settingsRedirect(appUrl, { google_error: 'state_expired' });
  }

  await supabase
    .from('meta_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_hash', stateHash);

  const redirectUri = `${appUrl}/api/agency-access-config/google/callback`;

  let accessToken: string;
  let refreshToken: string | null = null;
  try {
    const tokenResult = await exchangeGoogleCode({ clientId, clientSecret, redirectUri, code });
    accessToken = tokenResult.access_token;
    refreshToken = tokenResult.refresh_token ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'unknown';
    console.error('[agency-access-config/google/callback] exchange failed:', msg);
    return settingsRedirect(appUrl, { google_error: 'exchange_failed' });
  }

  // Get the agency's Google email
  const userInfo = await fetchGoogleUserInfo(accessToken).catch(() => ({ email: '', name: undefined }));

  const updateFields: Record<string, unknown> = {
    company_id: stateRow.company_id,
    google_analytics_email: userInfo.email || null,
    google_gtm_email: userInfo.email || null,
    google_gbp_email: userInfo.email || null,
    google_search_console_email: userInfo.email || null,
    google_merchant_center_email: userInfo.email || null,
    google_user_name: userInfo.name ?? null,
    updated_at: new Date().toISOString(),
  };

  if (refreshToken) {
    updateFields.google_refresh_token_encrypted = encryptToken(refreshToken);
  }

  await supabase
    .from('agency_access_config')
    .upsert(updateFields, { onConflict: 'company_id' });

  return settingsRedirect(appUrl, { google_connected: '1' });
}
