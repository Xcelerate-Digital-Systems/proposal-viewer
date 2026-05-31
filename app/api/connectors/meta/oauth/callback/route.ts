// app/api/connectors/meta/oauth/callback/route.ts
//
// Facebook redirects the user's browser here after they approve. We:
//   1. Verify the CSRF state (single-use, time-bounded).
//   2. Exchange code → short-lived token → long-lived (~60 day) token.
//   3. Fetch the Meta user id + their ad accounts.
//   4. Upsert meta_connections (encrypted token) + meta_ad_accounts.
//   5. Redirect the user back to the connector settings page.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMeUser,
  fetchAdAccounts,
} from '@/lib/connectors/meta/api-client';
import { encryptToken } from '@/lib/connectors/meta/token-crypto';

export const dynamic = 'force-dynamic';

function redirect(url: string, status = 302) {
  return NextResponse.redirect(url, status);
}

function errorRedirect(appUrl: string, reason: string) {
  const u = new URL(`${appUrl}/settings?tab=integrations`);
  u.searchParams.set('error', reason);
  return redirect(u.toString());
}

export async function GET(req: NextRequest) {
  // Strip trailing slash — Meta's OAuth exchange compares redirect_uri strings
  // exactly, and a double-slash breaks the flow.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appUrl || !appId || !appSecret) {
    // Can't even redirect gracefully without appUrl — return JSON.
    return NextResponse.json(
      { error: 'Meta connector is not configured on the server' },
      { status: 500 },
    );
  }

  const params = req.nextUrl.searchParams;
  const error = params.get('error');
  if (error) {
    return errorRedirect(appUrl, `facebook_denied:${error}`);
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return errorRedirect(appUrl, 'missing_code_or_state');
  }

  const supabase = createServiceClient();
  const stateHash = createHash('sha256').update(state).digest('hex');

  const { data: stateRow } = await supabase
    .from('meta_oauth_states')
    .select('company_id, user_id, redirect_to, expires_at, consumed_at')
    .eq('state_hash', stateHash)
    .single();

  if (!stateRow) return errorRedirect(appUrl, 'invalid_state');
  if (stateRow.consumed_at) return errorRedirect(appUrl, 'state_already_used');
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return errorRedirect(appUrl, 'state_expired');
  }

  // Mark state consumed before we do any outbound work — prevents replay.
  await supabase
    .from('meta_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_hash', stateHash);

  const redirectUri = `${appUrl}/api/connectors/meta/oauth/callback`;

  let longLivedToken: string;
  let expiresIn: number;
  let metaUser: { id: string; name?: string };
  try {
    const shortLived = await exchangeCodeForToken({
      appId, appSecret, redirectUri, code,
    });
    const longLived = await exchangeForLongLivedToken({
      appId, appSecret, shortLivedToken: shortLived.access_token,
    });
    longLivedToken = longLived.access_token;
    expiresIn = longLived.expires_in ?? 60 * 24 * 3600; // fallback: 60 days
    metaUser = await fetchMeUser(longLivedToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return errorRedirect(appUrl, `exchange_failed:${encodeURIComponent(msg.slice(0, 80))}`);
  }

  const accounts = await fetchAdAccounts(longLivedToken).catch(() => []);

  const encryptedToken = encryptToken(longLivedToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scopes = ['ads_read', 'business_management'];

  const { data: connection, error: connErr } = await supabase
    .from('meta_connections')
    .upsert(
      {
        company_id: stateRow.company_id,
        meta_user_id: metaUser.id,
        meta_user_name: metaUser.name ?? null,
        access_token_encrypted: encryptedToken,
        expires_at: expiresAt,
        scopes,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,meta_user_id' },
    )
    .select('id')
    .single();

  if (connErr || !connection) {
    return errorRedirect(appUrl, `db_error:${encodeURIComponent(connErr?.message ?? 'unknown')}`);
  }

  if (accounts.length > 0) {
    const rows = accounts.map((a) => ({
      connection_id: connection.id,
      ad_account_id: a.id,
      account_name: a.name ?? null,
      currency: a.currency ?? null,
      timezone_name: a.timezone_name ?? null,
      business_name: a.business?.name ?? null,
      enabled: true,
    }));
    await supabase.from('meta_ad_accounts').upsert(rows, {
      onConflict: 'connection_id,ad_account_id',
      ignoreDuplicates: false,
    });
  }

  const base = stateRow.redirect_to
    ? `${appUrl}${stateRow.redirect_to}`
    : `${appUrl}/settings?tab=integrations`;
  const dest = new URL(base);
  dest.searchParams.set('connected', '1');
  return redirect(dest.toString());
}
