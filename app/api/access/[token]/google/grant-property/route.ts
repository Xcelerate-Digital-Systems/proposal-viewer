import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { decryptToken } from '@/lib/connectors/google/token-crypto';
import { grantGA4Access, grantGTMAccess, grantGBPAccess, grantGSCAccess, grantMerchantCenterAccess } from '@/lib/connectors/google/api-client';
import { PLATFORM_LABELS } from '@/lib/client-access/types';
import { notifyAccessCompletion } from '@/lib/client-access/notify-completion';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = ipFromRequest(req);
  const rl = await rateLimit({ key: `pub-access-grant-prop:${ip}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 20) });
  }

  const body = await req.json().catch(() => null);
  const platform = body?.platform as string;
  const selectedId = body?.selected_id as string;
  const selectedName = body?.selected_name as string;

  if (!platform || !selectedId) {
    return NextResponse.json({ error: 'platform and selected_id required' }, { status: 400 });
  }

  const SUPPORTED_PLATFORMS = ['google_ga4', 'google_gtm', 'google_gbp', 'google_search_console', 'google_merchant_center'];
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from('client_access_requests')
    .select('id, company_id, status')
    .eq('share_token', token)
    .single();

  if (!request || request.status === 'revoked') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: grant } = await supabase
    .from('client_access_grants')
    .select('id, status, metadata, oauth_token_encrypted, oauth_refresh_token_encrypted')
    .eq('request_id', request.id)
    .eq('platform', platform)
    .single();

  if (!grant) {
    return NextResponse.json({ error: `No ${platform} grant found` }, { status: 404 });
  }

  if (grant.status !== 'oauth_complete') {
    return NextResponse.json({ error: 'Grant not in selectable state' }, { status: 400 });
  }

  const meta = grant.metadata as Record<string, unknown>;

  // Validate selected item is in the metadata
  if (platform === 'google_ga4') {
    const properties = meta?.ga4_properties as Array<{ id: string }> | undefined;
    if (!properties?.some((p) => p.id === selectedId)) {
      return NextResponse.json({ error: 'Property not in accessible list' }, { status: 400 });
    }
  } else if (platform === 'google_gtm') {
    const accounts = meta?.gtm_accounts as Array<{ id: string }> | undefined;
    if (!accounts?.some((a) => a.id === selectedId)) {
      return NextResponse.json({ error: 'Account not in accessible list' }, { status: 400 });
    }
  } else if (platform === 'google_gbp') {
    const accounts = meta?.gbp_accounts as Array<{ id: string }> | undefined;
    if (!accounts?.some((a) => a.id === selectedId)) {
      return NextResponse.json({ error: 'Account not in accessible list' }, { status: 400 });
    }
  } else if (platform === 'google_search_console') {
    const sites = meta?.gsc_sites as Array<{ id: string }> | undefined;
    if (!sites?.some((s) => s.id === selectedId)) {
      return NextResponse.json({ error: 'Site not in accessible list' }, { status: 400 });
    }
  } else if (platform === 'google_merchant_center') {
    const merchants = meta?.merchant_accounts as Array<{ id: string }> | undefined;
    if (!merchants?.some((m) => m.id === selectedId)) {
      return NextResponse.json({ error: 'Account not in accessible list' }, { status: 400 });
    }
  }

  // Get agency config for email
  const { data: agencyConfig } = await supabase
    .from('agency_access_config')
    .select('google_analytics_email, google_gtm_email, google_gbp_email, google_search_console_email, google_merchant_center_email')
    .eq('company_id', request.company_id)
    .single();

  const emailMap: Record<string, string | null | undefined> = {
    google_ga4: agencyConfig?.google_analytics_email,
    google_gtm: agencyConfig?.google_gtm_email,
    google_gbp: agencyConfig?.google_gbp_email,
    google_search_console: agencyConfig?.google_search_console_email,
    google_merchant_center: agencyConfig?.google_merchant_center_email,
  };
  const agencyEmail = emailMap[platform];

  if (!agencyEmail) {
    await supabase
      .from('client_access_grants')
      .update({
        status: 'failed',
        error_message: `Agency ${PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform} email not configured`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', grant.id);
    return NextResponse.json({ error: 'Agency email not configured for this platform' }, { status: 500 });
  }

  // Refresh the client's access token
  let clientAccessToken: string | null = null;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (grant.oauth_refresh_token_encrypted && clientId && clientSecret) {
    try {
      const refreshToken = decryptToken(grant.oauth_refresh_token_encrypted as string);
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      const json = await res.json() as Record<string, unknown>;
      if (res.ok) {
        clientAccessToken = json.access_token as string;
      }
    } catch { /* fall through */ }
  }

  if (!clientAccessToken && grant.oauth_token_encrypted) {
    try {
      clientAccessToken = decryptToken(grant.oauth_token_encrypted as string);
    } catch { /* fall through */ }
  }

  if (!clientAccessToken) {
    await supabase
      .from('client_access_grants')
      .update({ status: 'failed', error_message: 'Client token unavailable', updated_at: new Date().toISOString() })
      .eq('id', grant.id);
    return NextResponse.json({ error: 'Client token unavailable' }, { status: 502 });
  }

  // Grant access
  try {
    if (platform === 'google_ga4') {
      await grantGA4Access({ accessToken: clientAccessToken, propertyId: selectedId, agencyEmail });
    } else if (platform === 'google_gtm') {
      const gtmAccounts = meta?.gtm_accounts as Array<{ id: string; path: string }> | undefined;
      const accountPath = gtmAccounts?.find((a) => a.id === selectedId)?.path;
      if (!accountPath) {
        return NextResponse.json({ error: 'Account path not found' }, { status: 400 });
      }
      await grantGTMAccess({ accessToken: clientAccessToken, accountPath, agencyEmail });
    } else if (platform === 'google_gbp') {
      await grantGBPAccess({ accessToken: clientAccessToken, accountName: selectedId, agencyEmail });
    } else if (platform === 'google_search_console') {
      await grantGSCAccess({ accessToken: clientAccessToken, siteUrl: selectedId, agencyEmail });
    } else if (platform === 'google_merchant_center') {
      await grantMerchantCenterAccess({ accessToken: clientAccessToken, merchantId: selectedId, agencyEmail });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : 'unknown';
    console.error(`[grant-property] ${platform} grant failed:`, msg);
    await supabase
      .from('client_access_grants')
      .update({
        status: 'failed',
        error_message: msg,
        platform_account_name: selectedName || selectedId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', grant.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // GBP sends an invitation (needs agency to accept), others grant directly
  const finalStatus = platform === 'google_gbp' ? 'request_sent' : 'granted';

  // Update grant status
  await supabase
    .from('client_access_grants')
    .update({
      status: finalStatus,
      platform_account_name: selectedName || selectedId,
      error_message: null,
      metadata: { ...meta, selected_id: selectedId },
      granted_at: finalStatus === 'granted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', grant.id);

  // Check if all grants are done
  const { data: allGrants } = await supabase
    .from('client_access_grants')
    .select('status')
    .eq('request_id', request.id);

  const allDone = (allGrants ?? []).every(
    (g) => g.status === 'granted' || g.status === 'request_sent' || g.status === 'self_reported',
  );

  await supabase
    .from('client_access_requests')
    .update({ status: allDone ? 'complete' : 'partial', updated_at: new Date().toISOString() })
    .eq('id', request.id);

  if (allDone) {
    notifyAccessCompletion({ requestId: request.id, companyId: request.company_id })
      .catch((err) => console.error('[grant-property] completion notify error:', err));
  }

  return NextResponse.json({ success: true, status: 'granted' });
}
