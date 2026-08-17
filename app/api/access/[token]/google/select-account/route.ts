import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { decryptToken } from '@/lib/connectors/google/token-crypto';
import { createMccLink, acceptMccLink } from '@/lib/connectors/google/api-client';
import { notifyAccessCompletion } from '@/lib/client-access/notify-completion';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = ipFromRequest(req);
  const rl = await rateLimit({ key: `pub-access-select:${ip}`, limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 20) });
  }

  const body = await req.json().catch(() => null);

  // Support both single customer_id and array customer_ids
  let customerIds: string[];
  let customerNames: Record<string, string> = {};
  if (Array.isArray(body?.customer_ids)) {
    customerIds = body.customer_ids.filter((id: unknown) => typeof id === 'string' && id);
    if (body.customer_names && typeof body.customer_names === 'object') {
      customerNames = body.customer_names;
    }
  } else if (body?.customer_id && typeof body.customer_id === 'string') {
    customerIds = [body.customer_id];
    if (body.customer_name) customerNames[body.customer_id] = body.customer_name;
  } else {
    return NextResponse.json({ error: 'customer_ids (array) or customer_id required' }, { status: 400 });
  }

  if (customerIds.length === 0) {
    return NextResponse.json({ error: 'No accounts selected' }, { status: 400 });
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
    .select('id, status, metadata, oauth_token_encrypted, oauth_refresh_token_encrypted, token_expires_at')
    .eq('request_id', request.id)
    .eq('platform', 'google_ads')
    .single();

  if (!grant) {
    return NextResponse.json({ error: 'No Google Ads grant found' }, { status: 404 });
  }

  if (grant.status !== 'oauth_complete') {
    return NextResponse.json({ error: 'Grant not in selectable state' }, { status: 400 });
  }

  // Verify selected accounts are in the metadata
  const accounts = (grant.metadata as Record<string, unknown>)?.customer_accounts as Array<{ id: string }> | undefined;
  const validIds = new Set(accounts?.map((a) => a.id) ?? []);
  const invalidIds = customerIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: `Account(s) not in accessible list: ${invalidIds.join(', ')}` }, { status: 400 });
  }

  // Get agency config for MCC credentials
  const { data: agencyConfig } = await supabase
    .from('agency_access_config')
    .select('google_mcc_id, google_refresh_token_encrypted')
    .eq('company_id', request.company_id)
    .single();

  if (!agencyConfig?.google_mcc_id || !agencyConfig?.google_refresh_token_encrypted) {
    return NextResponse.json({ error: 'Agency MCC not configured' }, { status: 500 });
  }

  // Agency MCC token was issued under GOOGLE_CLIENT_ID (via agency-access-config OAuth)
  const agencyClientId = process.env.GOOGLE_CLIENT_ID;
  const agencyClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!agencyClientId || !agencyClientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  // Client token was issued under GOOGLE_ADS_CLIENT_ID if set (via auth/google/callback for google_ads)
  const clientOAuthId = process.env.GOOGLE_ADS_CLIENT_ID || agencyClientId;
  const clientOAuthSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || agencyClientSecret;

  // Refresh the agency's MCC access token
  let agencyAccessToken: string;
  try {
    const refreshToken = decryptToken(agencyConfig.google_refresh_token_encrypted);
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
      console.error('[select-account] Agency token refresh failed:', JSON.stringify(json).slice(0, 200));
      return NextResponse.json({ error: 'Failed to refresh agency token' }, { status: 502 });
    }
    agencyAccessToken = json.access_token as string;
  } catch (e) {
    return NextResponse.json({ error: `Token refresh failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Refresh the client's access token for auto-accepting
  let clientAccessToken: string | null = null;
  if (grant.oauth_refresh_token_encrypted) {
    try {
      const clientRefresh = decryptToken(grant.oauth_refresh_token_encrypted as string);
      const clientRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientOAuthId,
          client_secret: clientOAuthSecret,
          refresh_token: clientRefresh,
          grant_type: 'refresh_token',
        }),
      });
      const clientJson = await clientRes.json() as Record<string, unknown>;
      if (clientRes.ok) {
        clientAccessToken = clientJson.access_token as string;
        console.log('[select-account] Client token refreshed successfully');
      } else {
        console.warn('[select-account] Client token refresh failed:', JSON.stringify(clientJson).slice(0, 200));
      }
    } catch (e) {
      console.warn('[select-account] Could not refresh client token:', (e as Error).message);
    }
  } else if (grant.oauth_token_encrypted) {
    try {
      clientAccessToken = decryptToken(grant.oauth_token_encrypted as string);
      console.log('[select-account] Using stored client access token (no refresh token available)');
    } catch {
      console.warn('[select-account] Could not decrypt client token');
    }
  }

  // Process each selected account
  const linked: string[] = [];
  const names: string[] = [];
  const errors: string[] = [];
  let autoAccepted = false;

  for (const customerId of customerIds) {
    const name = customerNames[customerId] || customerId;
    try {
      // 1. Manager creates PENDING link
      console.log(`[select-account] Creating MCC link: manager=${agencyConfig.google_mcc_id} -> client=${customerId}`);
      await createMccLink({
        accessToken: agencyAccessToken,
        clientCustomerId: customerId,
        managerCustomerId: agencyConfig.google_mcc_id,
      });
      console.log(`[select-account] MCC link created for ${customerId}`);

      // 2. Auto-accept using client's token (retry with increasing delays)
      if (clientAccessToken) {
        const delays = [3000, 5000, 7000];
        for (let attempt = 0; attempt < delays.length; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
          try {
            console.log(`[select-account] Auto-accept attempt ${attempt + 1} for ${customerId}...`);
            await acceptMccLink({
              clientAccessToken,
              clientCustomerId: customerId,
              managerCustomerId: agencyConfig.google_mcc_id,
            });
            console.log(`[select-account] Auto-accept succeeded for ${customerId} on attempt ${attempt + 1}`);
            autoAccepted = true;
            break;
          } catch (e) {
            console.warn(`[select-account] Auto-accept attempt ${attempt + 1} failed for ${customerId}:`, (e as Error).message);
            if (attempt === delays.length - 1) {
              console.warn(`[select-account] All auto-accept attempts exhausted for ${customerId}`);
            }
          }
        }
      } else {
        console.warn(`[select-account] No client token available, skipping auto-accept for ${customerId}`);
      }

      linked.push(customerId);
      names.push(name);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : 'unknown';
      console.error(`[select-account] Failed to link ${customerId}:`, msg);
      errors.push(`${name}: ${msg}`);
    }
  }

  if (linked.length === 0) {
    await supabase
      .from('client_access_grants')
      .update({
        status: 'failed',
        error_message: errors.join('; ').slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', grant.id);
    return NextResponse.json({ error: errors.join('; ') }, { status: 502 });
  }

  // Only mark as 'granted' if auto-accept succeeded; otherwise 'request_sent'
  const finalStatus = autoAccepted ? 'granted' : 'request_sent';
  const errorMsg = !autoAccepted
    ? 'Link created but needs manual acceptance in Google Ads'
    : errors.length > 0 ? `Partial: ${errors.join('; ')}` : null;

  await supabase
    .from('client_access_grants')
    .update({
      status: finalStatus,
      platform_account_name: names.join(', '),
      error_message: errorMsg,
      metadata: {
        ...((grant.metadata as Record<string, unknown>) || {}),
        selected_customer_ids: linked,
        auto_accepted: autoAccepted,
        link_errors: errors.length > 0 ? errors : undefined,
      },
      granted_at: autoAccepted ? new Date().toISOString() : null,
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
      .catch((err) => console.error('[select-account] completion notify error:', err));
  }

  return NextResponse.json({
    success: true,
    status: finalStatus,
    auto_accepted: autoAccepted,
    linked: linked.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
