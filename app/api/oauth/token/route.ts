// app/api/oauth/token/route.ts
//
// Standard OAuth2 token endpoint. Accepts application/x-www-form-urlencoded
// (per RFC 6749) with grant_type=authorization_code. Validates the client
// credentials, consumes the one-time code, returns the long-lived access_token
// that the client stores and uses for subsequent API calls.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { getOAuthClient, hashSecret, constantTimeEquals } from '@/lib/oauth-clients/server';
import { rateLimit, ipFromRequest } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Gate verbose flow logs on an env flag — they're useful for debugging the
// Looker Studio OAuth integration but leak client_id / redirect_uri / partial
// code hashes into production logs when always on.
const DEBUG_OAUTH = process.env.DEBUG_OAUTH === '1' && process.env.NODE_ENV !== 'production';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_OAUTH) console.log(...args);
};

function oauthError(code: string, description: string, status = 400) {
  // OAuth2 error response shape per RFC 6749 §5.2.
  return NextResponse.json({ error: code, error_description: description }, { status });
}

async function readForm(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (contentType.includes('application/json')) {
    const json = await req.json().catch(() => ({}));
    return Object.fromEntries(
      Object.entries(json).map(([k, v]) => [k, String(v ?? '')]),
    );
  }
  // Fallback: try to parse as form-urlencoded regardless of content-type.
  // Some OAuth2 libraries (e.g. Apps Script) may send without a content-type
  // header or with an unexpected one.
  const text = await req.text().catch(() => '');
  if (text) {
    debugLog('[oauth/token] readForm fallback — content-type=%s body=%s', contentType, text.slice(0, 200));
    return Object.fromEntries(new URLSearchParams(text));
  }
  return {};
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `oauth:token:${ipFromRequest(req)}`, limit: 10, windowSeconds: 60 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const form = await readForm(req);

  const grant_type = form.grant_type;
  const code = form.code;
  const redirect_uri = form.redirect_uri;
  const client_id = form.client_id;
  const client_secret = form.client_secret;

  // Diagnostic: log what the OAuth2 client is sending so we can debug
  // redirect-loop issues with the Looker Studio connector.
  debugLog('[oauth/token] grant_type=%s client_id=%s redirect_uri=%s code_present=%s secret_present=%s content-type=%s',
    grant_type, client_id, redirect_uri, !!code, !!client_secret, req.headers.get('content-type'));

  if (grant_type !== 'authorization_code') {
    debugLog('[oauth/token] REJECTED: unsupported_grant_type');
    return oauthError('unsupported_grant_type', 'Only authorization_code is supported');
  }
  if (!code || !redirect_uri || !client_id || !client_secret) {
    debugLog('[oauth/token] REJECTED: missing param — code=%s uri=%s id=%s secret=%s',
      !!code, !!redirect_uri, !!client_id, !!client_secret);
    return oauthError('invalid_request', 'Missing required parameter');
  }

  const client = await getOAuthClient(client_id);
  if (!client) {
    debugLog('[oauth/token] REJECTED: unknown client_id %s', client_id);
    return oauthError('invalid_client', 'Unknown client_id', 401);
  }

  if (!constantTimeEquals(hashSecret(client_secret), client.client_secret_hash)) {
    debugLog('[oauth/token] REJECTED: bad client_secret for %s', client_id);
    return oauthError('invalid_client', 'Invalid client credentials', 401);
  }

  const code_hash = createHash('sha256').update(code).digest('hex');
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from('oauth_auth_codes')
    .select('code_hash, client_id, redirect_uri, plaintext_token, expires_at, consumed_at')
    .eq('code_hash', code_hash)
    .single();

  if (!row) {
    debugLog('[oauth/token] REJECTED: unknown code (hash=%s)', code_hash.slice(0, 12));
    return oauthError('invalid_grant', 'Unknown code');
  }
  if (row.consumed_at) {
    debugLog('[oauth/token] REJECTED: code already consumed at %s', row.consumed_at);
    return oauthError('invalid_grant', 'Code already used');
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    debugLog('[oauth/token] REJECTED: code expired at %s', row.expires_at);
    return oauthError('invalid_grant', 'Code expired');
  }
  if (row.client_id !== client_id) {
    debugLog('[oauth/token] REJECTED: client_id mismatch — code issued to %s, request from %s', row.client_id, client_id);
    return oauthError('invalid_grant', 'Code was not issued to this client');
  }
  if (row.redirect_uri !== redirect_uri) {
    debugLog('[oauth/token] REJECTED: redirect_uri mismatch — stored=%s received=%s', row.redirect_uri, redirect_uri);
    return oauthError('invalid_grant', 'redirect_uri does not match the authorization request');
  }
  if (!row.plaintext_token) {
    return oauthError('invalid_grant', 'Code unusable');
  }

  const token = row.plaintext_token;

  // Atomically consume — if another request already consumed the code, 0 rows
  // will be updated and we must not return the token.
  const { data: consumed } = await supabase
    .from('oauth_auth_codes')
    .update({ consumed_at: new Date().toISOString(), plaintext_token: null })
    .eq('code_hash', code_hash)
    .is('consumed_at', null)
    .select('code_hash');

  if (!consumed || consumed.length === 0) {
    return oauthError('invalid_grant', 'Code already used');
  }

  debugLog('[oauth/token] SUCCESS: token issued for client_id=%s', client_id);

  // av_live_ tokens don't expire on our side — we still report a large
  // expires_in so OAuth2 libraries don't aggressively "refresh". No refresh
  // token issued; clients re-authorize on revocation.
  return NextResponse.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 60 * 60 * 24 * 365, // 1 year (nominal)
  });
}
