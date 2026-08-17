import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import {
  exchangeGoogleCode,
  fetchGA4AccountSummaries,
  grantGA4Access,
  fetchGTMAccounts,
  grantGTMAccess,
  fetchAccessibleCustomers,
  createMccLink,
} from '@/lib/connectors/google/api-client';
import { encryptToken, decryptToken } from '@/lib/connectors/google/token-crypto';
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
    .select('google_mcc_id, google_analytics_email, google_gtm_email, google_refresh_token_encrypted')
    .eq('company_id', accessRequest.company_id)
    .single();

  let grantStatus: string = 'oauth_complete';
  let accountName: string | null = null;
  let metadata: Record<string, unknown> = {};

  try {
    if (platform === 'google_ga4') {
      console.log(`[google-cb] GA4 grant starting, agencyEmail=${agencyConfig?.google_analytics_email ?? 'NONE'}`);
      const result = await handleGA4Grant(accessToken, agencyConfig?.google_analytics_email);
      grantStatus = result.status;
      accountName = result.accountName;
      metadata = result.metadata;
    } else if (platform === 'google_gtm') {
      console.log(`[google-cb] GTM grant starting, agencyEmail=${agencyConfig?.google_gtm_email ?? 'NONE'}`);
      const result = await handleGTMGrant(accessToken, agencyConfig?.google_gtm_email);
      grantStatus = result.status;
      accountName = result.accountName;
      metadata = result.metadata;
    } else if (platform === 'google_ads') {
      console.log(`[google-cb] Google Ads grant starting, mccId=${agencyConfig?.google_mcc_id ?? 'NONE'}`);
      const result = await handleGoogleAdsGrant(accessToken, agencyConfig);
      grantStatus = result.status;
      accountName = result.accountName;
      metadata = result.metadata;
      console.log(`[google-cb] Google Ads grant result: status=${result.status}, accounts=${result.accountName}, meta=${JSON.stringify(result.metadata)}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : 'unknown';
    const stack = e instanceof Error ? e.stack?.slice(0, 300) : '';
    console.error(`[google-cb] ${platform} grant FAILED:`, msg);
    if (stack) console.error(`[google-cb] stack:`, stack);
    grantStatus = 'failed';
    metadata = { error: msg };
  }

  console.log(`[google-cb] Final grant update: platform=${platform}, status=${grantStatus}, account=${accountName}`);

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
    .eq('id', stateRow.grant_id);

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

  const queryStatus = grantStatus === 'granted' ? 'connected' : grantStatus === 'request_sent' ? 'pending' : 'error';
  const redirectQuery: Record<string, string> = { [platform]: queryStatus };
  if (queryStatus === 'error' && metadata.error) {
    redirectQuery.reason = String(metadata.error).slice(0, 200);
  }
  return accessRedirect(appUrl, token, redirectQuery);
}

// --- Platform-specific grant handlers ---

async function handleGA4Grant(
  accessToken: string,
  agencyEmail: string | null | undefined,
): Promise<{ status: string; accountName: string | null; metadata: Record<string, unknown> }> {
  const summaries = await fetchGA4AccountSummaries(accessToken);
  const properties = summaries.flatMap(
    (s) => (s.propertySummaries ?? []).map((p) => ({ ...p, accountName: s.displayName })),
  );

  if (properties.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No GA4 properties found' } };
  }

  if (!agencyEmail) {
    return {
      status: 'oauth_complete',
      accountName: properties.map((p) => p.displayName).join(', '),
      metadata: { properties: properties.map((p) => ({ id: p.property, name: p.displayName })), needs_agency_email: true },
    };
  }

  let grantedCount = 0;
  const names: string[] = [];
  for (const prop of properties) {
    try {
      await grantGA4Access({ accessToken, propertyId: prop.property, agencyEmail });
      grantedCount++;
      names.push(prop.displayName);
    } catch (e) {
      console.error(`[GA4] grant failed for ${prop.property}:`, e);
    }
  }

  return {
    status: grantedCount > 0 ? 'granted' : 'failed',
    accountName: names.join(', ') || null,
    metadata: { properties_granted: grantedCount, total_properties: properties.length },
  };
}

async function handleGTMGrant(
  accessToken: string,
  agencyEmail: string | null | undefined,
): Promise<{ status: string; accountName: string | null; metadata: Record<string, unknown> }> {
  const accounts = await fetchGTMAccounts(accessToken);

  if (accounts.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No GTM accounts found' } };
  }

  if (!agencyEmail) {
    return {
      status: 'oauth_complete',
      accountName: accounts.map((a) => a.name).join(', '),
      metadata: { accounts: accounts.map((a) => ({ id: a.accountId, name: a.name })), needs_agency_email: true },
    };
  }

  let grantedCount = 0;
  const names: string[] = [];
  for (const account of accounts) {
    try {
      await grantGTMAccess({ accessToken, accountPath: account.path, agencyEmail });
      grantedCount++;
      names.push(account.name);
    } catch (e) {
      console.error(`[GTM] grant failed for ${account.accountId}:`, e);
    }
  }

  return {
    status: grantedCount > 0 ? 'granted' : 'failed',
    accountName: names.join(', ') || null,
    metadata: { accounts_granted: grantedCount, total_accounts: accounts.length },
  };
}

async function handleGoogleAdsGrant(
  clientAccessToken: string,
  agencyConfig: { google_mcc_id?: string | null; google_refresh_token_encrypted?: string | null } | null,
): Promise<{ status: string; accountName: string | null; metadata: Record<string, unknown> }> {
  const mccId = agencyConfig?.google_mcc_id;

  // List the client's accessible accounts using their token
  const customerResources = await fetchAccessibleCustomers(clientAccessToken);
  const customerIds = customerResources.map((r) => r.replace('customers/', ''));

  if (customerIds.length === 0) {
    return { status: 'failed', accountName: null, metadata: { error: 'No Google Ads accounts found' } };
  }

  if (!mccId) {
    return {
      status: 'oauth_complete',
      accountName: customerIds.join(', '),
      metadata: { customer_ids: customerIds, needs_mcc_id: true },
    };
  }

  // Get the agency's MCC access token to create the link from the manager side
  const encryptedRefresh = agencyConfig?.google_refresh_token_encrypted;
  if (!encryptedRefresh) {
    return {
      status: 'oauth_complete',
      accountName: customerIds.join(', '),
      metadata: { customer_ids: customerIds, error: 'Agency Google account not connected' },
    };
  }

  const agencyClientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const agencyClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!agencyClientId || !agencyClientSecret) {
    return { status: 'failed', accountName: customerIds.join(', '), metadata: { error: 'Google OAuth not configured' } };
  }

  let agencyAccessToken: string;
  try {
    const refreshToken = decryptToken(encryptedRefresh);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: agencyClientId,
        client_secret: agencyClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return { status: 'failed', accountName: customerIds.join(', '), metadata: { error: 'Failed to refresh agency token' } };
    }
    agencyAccessToken = json.access_token as string;
  } catch (e) {
    return { status: 'failed', accountName: customerIds.join(', '), metadata: { error: `Agency token refresh: ${(e as Error).message}` } };
  }

  let linkedCount = 0;
  const linkErrors: string[] = [];
  for (const customerId of customerIds) {
    try {
      await createMccLink({ accessToken: agencyAccessToken, clientCustomerId: customerId, managerCustomerId: mccId });
      linkedCount++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message.slice(0, 300) : String(e);
      console.error(`[google-ads] MCC link failed for ${customerId}:`, errMsg);
      linkErrors.push(`${customerId}: ${errMsg}`);
    }
  }

  return {
    status: linkedCount > 0 ? 'request_sent' : 'failed',
    accountName: customerIds.join(', '),
    metadata: {
      links_sent: linkedCount,
      total_customers: customerIds.length,
      ...(linkErrors.length > 0 ? { link_errors: linkErrors, error: linkErrors[0] } : {}),
    },
  };
}
