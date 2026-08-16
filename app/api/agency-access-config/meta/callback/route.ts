import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMeUser,
} from '@/lib/connectors/meta/api-client';
import { encryptToken } from '@/lib/connectors/meta/token-crypto';
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

export async function GET(req: NextRequest) {
  const rl = await rateLimit({ key: `agency-meta-cb:${ipFromRequest(req)}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 20) });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appUrl || !appId || !appSecret) {
    return NextResponse.json({ error: 'Meta connector not configured' }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;

  if (params.get('error')) {
    return settingsRedirect(appUrl, { meta_error: 'denied' });
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return settingsRedirect(appUrl, { meta_error: 'missing_code' });
  }

  const supabase = createServiceClient();
  const stateHash = createHash('sha256').update(state).digest('hex');

  const { data: stateRow } = await supabase
    .from('meta_oauth_states')
    .select('company_id, user_id, expires_at, consumed_at')
    .eq('state_hash', stateHash)
    .single();

  if (!stateRow) return settingsRedirect(appUrl, { meta_error: 'invalid_state' });
  if (stateRow.consumed_at) return settingsRedirect(appUrl, { meta_error: 'state_used' });
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return settingsRedirect(appUrl, { meta_error: 'state_expired' });
  }

  await supabase
    .from('meta_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_hash', stateHash);

  const redirectUri = `${appUrl}/api/agency-access-config/meta/callback`;

  let longLivedToken: string;
  let metaUser: { id: string; name?: string };
  try {
    const shortLived = await exchangeCodeForToken({ appId, appSecret, redirectUri, code });
    const longLived = await exchangeForLongLivedToken({
      appId, appSecret, shortLivedToken: shortLived.access_token,
    });
    longLivedToken = longLived.access_token;
    metaUser = await fetchMeUser(longLivedToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'unknown';
    console.error('[agency-access-config/meta/callback] exchange failed:', msg);
    return settingsRedirect(appUrl, { meta_error: 'exchange_failed' });
  }

  const encryptedToken = encryptToken(longLivedToken);

  await supabase
    .from('agency_access_config')
    .upsert({
      company_id: stateRow.company_id,
      meta_user_id: metaUser.id,
      meta_user_name: metaUser.name ?? null,
      meta_token_encrypted: encryptedToken,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });

  return settingsRedirect(appUrl, { meta_connected: '1' });
}
