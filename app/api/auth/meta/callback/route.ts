import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMeUser,
  fetchAdAccounts,
  sendPartnerRequest,
} from '@/lib/connectors/meta/api-client';
import { encryptToken } from '@/lib/connectors/meta/token-crypto';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function accessRedirect(appUrl: string, token: string, query: Record<string, string>) {
  const url = new URL(`${appUrl}/access/${token}`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const ip = ipFromRequest(req);
  const rl = await rateLimit({ key: `pub-access-meta-cb:${ip}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl, 20) },
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appUrl || !appId || !appSecret) {
    return NextResponse.json({ error: 'Meta connector not configured' }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;

  // Look up state first to get redirect_token
  const state = searchParams.get('state');
  if (!state) {
    return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const stateHash = createHash('sha256').update(state).digest('hex');

  const { data: stateRow } = await supabase
    .from('client_access_oauth_states')
    .select('access_request_id, grant_id, platform, redirect_token, expires_at, consumed_at')
    .eq('state_hash', stateHash)
    .single();

  if (!stateRow) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  const token = stateRow.redirect_token;

  if (searchParams.get('error')) {
    return accessRedirect(appUrl, token, { meta: 'denied' });
  }

  const code = searchParams.get('code');
  if (!code) {
    return accessRedirect(appUrl, token, { meta: 'error', reason: 'missing_code' });
  }

  if (stateRow.consumed_at) {
    return accessRedirect(appUrl, token, { meta: 'error', reason: 'state_used' });
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return accessRedirect(appUrl, token, { meta: 'error', reason: 'state_expired' });
  }

  // Consume state immediately
  await supabase
    .from('client_access_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_hash', stateHash);

  // Exchange code for long-lived token
  const redirectUri = `${appUrl}/api/auth/meta/callback`;

  let longLivedToken: string;
  let expiresIn: number;
  let metaUser: { id: string; name?: string };
  try {
    const shortLived = await exchangeCodeForToken({ appId, appSecret, redirectUri, code });
    const longLived = await exchangeForLongLivedToken({
      appId,
      appSecret,
      shortLivedToken: shortLived.access_token,
    });
    longLivedToken = longLived.access_token;
    expiresIn = longLived.expires_in ?? 60 * 24 * 3600;
    metaUser = await fetchMeUser(longLivedToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 100) : 'unknown';
    console.error('[api/auth/meta/callback] token exchange failed:', msg);
    await supabase
      .from('client_access_grants')
      .update({ status: 'failed', error_message: 'OAuth token exchange failed', updated_at: new Date().toISOString() })
      .eq('id', stateRow.grant_id);
    return accessRedirect(appUrl, token, { meta: 'error', reason: 'exchange_failed' });
  }

  const encryptedToken = encryptToken(longLivedToken);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const accounts = await fetchAdAccounts(longLivedToken).catch(() => []);

  const { data: accessRequest } = await supabase
    .from('client_access_requests')
    .select('company_id')
    .eq('id', stateRow.access_request_id)
    .single();

  if (!accessRequest) {
    return accessRedirect(appUrl, token, { meta: 'error', reason: 'request_not_found' });
  }

  const { data: agencyConfig } = await supabase
    .from('agency_access_config')
    .select('meta_business_id')
    .eq('company_id', accessRequest.company_id)
    .single();

  let partnerRequestId: string | null = null;
  let sentCount = 0;

  if (agencyConfig?.meta_business_id && accounts.length > 0) {
    for (const account of accounts) {
      try {
        const result = await sendPartnerRequest({
          agencyBmId: agencyConfig.meta_business_id,
          clientAdAccountId: account.id,
          accessToken: longLivedToken,
          permittedTasks: ['ADVERTISE', 'ANALYZE'],
        });
        if (!partnerRequestId) partnerRequestId = result.request_id;
        sentCount++;
      } catch (e) {
        console.error(`[api/auth/meta/callback] partner request failed for ${account.id}:`, e);
      }
    }
  }

  const grantStatus = sentCount > 0 ? 'request_sent' : 'oauth_complete';
  const accountNames = accounts.map((a) => a.name).filter(Boolean).join(', ');

  await supabase
    .from('client_access_grants')
    .update({
      status: grantStatus,
      oauth_token_encrypted: encryptedToken,
      token_expires_at: tokenExpiresAt,
      platform_user_id: metaUser.id,
      platform_user_name: metaUser.name ?? null,
      platform_account_name: accountNames || null,
      partner_request_id: partnerRequestId,
      error_message: null,
      metadata: {
        ad_accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
        partner_requests_sent: sentCount,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', stateRow.grant_id);

  const { data: allGrants } = await supabase
    .from('client_access_grants')
    .select('status')
    .eq('request_id', stateRow.access_request_id);

  const allDone = (allGrants ?? []).every(
    (g) => g.status === 'granted' || g.status === 'request_sent' || g.status === 'self_reported',
  );

  await supabase
    .from('client_access_requests')
    .update({
      status: allDone ? 'complete' : 'partial',
      updated_at: new Date().toISOString(),
    })
    .eq('id', stateRow.access_request_id);

  return accessRedirect(appUrl, token, {
    meta: grantStatus === 'request_sent' ? 'pending' : 'connected',
  });
}
