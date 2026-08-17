import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import {
  exchangeGoogleCode,
  fetchGA4AccountSummaries,
  fetchGTMAccounts,
  fetchAccessibleCustomers,
  fetchCustomerDetails,
} from '@/lib/connectors/google/api-client';
import { encryptToken } from '@/lib/connectors/google/token-crypto';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import type { AccessPlatform } from '@/lib/client-access/types';

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
  const rl = await rateLimit({ key: `pub-access-google-cb:${ip}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl, 20) },
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

  // We need to peek at the state to determine the platform before we can pick creds,
  // but we also need creds to proceed. Resolve both client ID sets upfront.
  const defaultClientId = process.env.GOOGLE_CLIENT_ID;
  const defaultClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const adsClientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const adsClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!appUrl || !defaultClientId || !defaultClientSecret) {
    return NextResponse.json({ error: 'Google connector not configured' }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;

  // Look up state first to get redirect_token for error redirects
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
    return accessRedirect(appUrl, token, { google: 'denied' });
  }

  const code = searchParams.get('code');
  if (!code) {
    return accessRedirect(appUrl, token, { google: 'error', reason: 'missing_code' });
  }

  if (stateRow.consumed_at) {
    return accessRedirect(appUrl, token, { google: 'error', reason: 'state_used' });
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return accessRedirect(appUrl, token, { google: 'error', reason: 'state_expired' });
  }

  // Consume state immediately
  await supabase
    .from('client_access_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_hash', stateHash);

  const platform = stateRow.platform as AccessPlatform;
  const isAds = platform === 'google_ads';
  const clientId = (isAds && adsClientId) ? adsClientId : defaultClientId;
  const clientSecret = (isAds && adsClientSecret) ? adsClientSecret : defaultClientSecret;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Exchange code for tokens
  let accessToken: string;
  let refreshToken: string | null = null;
  let expiresIn: number;
  try {
    const tokenResult = await exchangeGoogleCode({ clientId, clientSecret, redirectUri, code });
    accessToken = tokenResult.access_token;
    refreshToken = tokenResult.refresh_token ?? null;
    expiresIn = tokenResult.expires_in;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 100) : 'unknown';
    console.error('[api/auth/google/callback] token exchange failed:', msg);
    await supabase
      .from('client_access_grants')
      .update({ status: 'failed', error_message: 'OAuth token exchange failed', updated_at: new Date().toISOString() })
      .eq('id', stateRow.grant_id);
    return accessRedirect(appUrl, token, { google: 'error', reason: 'exchange_failed' });
  }

  const encryptedAccessToken = encryptToken(accessToken);
  const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Fetch the signed-in user's email for the "Connected as" panel
  let googleEmail: string | null = null;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.ok) {
      const userInfo = await userRes.json() as { email?: string };
      googleEmail = userInfo.email ?? null;
    }
  } catch {
    // Non-critical — continue without email
  }

  // Get agency config for email/MCC ID
  const { data: accessRequest } = await supabase
    .from('client_access_requests')
    .select('company_id')
    .eq('id', stateRow.access_request_id)
    .single();

  if (!accessRequest) {
    return accessRedirect(appUrl, token, { google: 'error', reason: 'request_not_found' });
  }

  const { data: agencyConfig } = await supabase
    .from('agency_access_config')
    .select('google_mcc_id, google_analytics_email, google_gtm_email')
    .eq('company_id', accessRequest.company_id)
    .single();

  // Process ALL Google grants for this request (one sign-in covers all Google platforms)
  const { data: googleGrants } = await supabase
    .from('client_access_grants')
    .select('id, platform, status')
    .eq('request_id', stateRow.access_request_id)
    .in('platform', ['google_ads', 'google_ga4', 'google_gtm']);

  const grantsToProcess = (googleGrants ?? []).filter(
    (g) => g.status === 'pending' || g.status === 'failed' || g.id === stateRow.grant_id,
  );

  const redirectQuery: Record<string, string> = {};
  let primaryStatus = 'oauth_complete';

  for (const grantRow of grantsToProcess) {
    const gPlatform = grantRow.platform as string;
    let grantStatus = 'oauth_complete';
    let accountName: string | null = null;
    let metadata: Record<string, unknown> = {};

    try {
      if (gPlatform === 'google_ga4') {
        console.log(`[google-cb] GA4 grant starting, agencyEmail=${agencyConfig?.google_analytics_email ?? 'NONE'}`);
        const result = await handleGA4Grant(accessToken, agencyConfig?.google_analytics_email);
        grantStatus = result.status;
        accountName = result.accountName;
        metadata = result.metadata;
      } else if (gPlatform === 'google_gtm') {
        console.log(`[google-cb] GTM grant starting, agencyEmail=${agencyConfig?.google_gtm_email ?? 'NONE'}`);
        const result = await handleGTMGrant(accessToken, agencyConfig?.google_gtm_email);
        grantStatus = result.status;
        accountName = result.accountName;
        metadata = result.metadata;
      } else if (gPlatform === 'google_ads') {
        console.log(`[google-cb] Google Ads grant starting, mccId=${agencyConfig?.google_mcc_id ?? 'NONE'}`);
        const result = await handleGoogleAdsGrant(accessToken, agencyConfig);
        grantStatus = result.status;
        accountName = result.accountName;
        metadata = result.metadata;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 500) : 'unknown';
      console.error(`[google-cb] ${gPlatform} grant FAILED:`, msg);
      grantStatus = 'failed';
      metadata = { error: msg };
    }

    if (googleEmail) metadata.connected_email = googleEmail;

    console.log(`[google-cb] Grant update: platform=${gPlatform}, status=${grantStatus}, account=${accountName}`);

    await supabase
      .from('client_access_grants')
      .update({
        status: grantStatus,
        oauth_token_encrypted: encryptedAccessToken,
        oauth_refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: tokenExpiresAt,
        platform_account_name: accountName,
        error_message: grantStatus === 'failed' ? (metadata.error as string) ?? 'Grant failed' : null,
        metadata,
        granted_at: grantStatus === 'granted' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', grantRow.id);

    if (grantRow.id === stateRow.grant_id) primaryStatus = grantStatus;
    const qs = grantStatus === 'granted' ? 'connected' : grantStatus === 'request_sent' ? 'pending' : 'oauth_complete';
    redirectQuery[gPlatform] = qs;
  }

  // Update request status
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

  return accessRedirect(appUrl, token, redirectQuery);
}

// --- Platform-specific grant handlers ---

async function handleGA4Grant(
  accessToken: string,
  _agencyEmail: string | null | undefined,
): Promise<{ status: string; accountName: string | null; metadata: Record<string, unknown> }> {
  const summaries = await fetchGA4AccountSummaries(accessToken);
  const properties = summaries.flatMap(
    (s) => (s.propertySummaries ?? []).map((p) => ({ ...p, accountName: s.displayName })),
  );

  if (properties.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No GA4 properties found' } };
  }

  // Return properties for client to select on the Grant Access step
  return {
    status: 'oauth_complete',
    accountName: null,
    metadata: {
      ga4_properties: properties.map((p) => ({ id: p.property, name: p.displayName, account: p.accountName })),
      needs_property_selection: true,
    },
  };
}

async function handleGTMGrant(
  accessToken: string,
  _agencyEmail: string | null | undefined,
): Promise<{ status: string; accountName: string | null; metadata: Record<string, unknown> }> {
  const accounts = await fetchGTMAccounts(accessToken);

  if (accounts.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No GTM accounts found' } };
  }

  // Return accounts for client to select on the Grant Access step
  return {
    status: 'oauth_complete',
    accountName: null,
    metadata: {
      gtm_accounts: accounts.map((a) => ({ id: a.accountId, name: a.name, path: a.path })),
      needs_account_selection: true,
    },
  };
}

async function handleGoogleAdsGrant(
  clientAccessToken: string,
  _agencyConfig: { google_mcc_id?: string | null; google_refresh_token_encrypted?: string | null } | null,
): Promise<{ status: string; accountName: string | null; metadata: Record<string, unknown> }> {
  // After OAuth, list the client's accounts and return them for selection.
  // The actual MCC link is created later when the client picks an account
  // via /api/access/[token]/google/select-account.
  const customerResources = await fetchAccessibleCustomers(clientAccessToken);
  const customerIds = customerResources.map((r) => r.replace('customers/', ''));

  if (customerIds.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No Google Ads accounts found' } };
  }

  // Fetch details (name, manager flag) for each account
  const accounts: Array<{ id: string; name: string; manager: boolean }> = [];
  for (const id of customerIds) {
    const detail = await fetchCustomerDetails(clientAccessToken, id);
    if (detail) {
      accounts.push({ id: detail.id, name: detail.descriptiveName, manager: detail.manager });
    }
  }

  // Filter to non-manager accounts (regular ad accounts the client would grant access to)
  const adAccounts = accounts.filter((a) => !a.manager);

  if (adAccounts.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No Google Ads accounts found (only MCC accounts detected)' } };
  }

  return {
    status: 'oauth_complete',
    accountName: null,
    metadata: { customer_accounts: adAccounts, needs_account_selection: true },
  };
}
