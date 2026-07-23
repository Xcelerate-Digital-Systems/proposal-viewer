// app/api/oauth/token/route.ts
//
// Standard OAuth2 token endpoint. Accepts application/x-www-form-urlencoded
// (per RFC 6749) with grant_type=authorization_code or refresh_token.
// Issues access + refresh tokens so the apps-script-oauth2 library can
// silently renew without re-prompting the user.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { getOAuthClient, hashSecret, constantTimeEquals } from '@/lib/oauth-clients/server';
import { rateLimit, ipFromRequest } from '@/lib/rate-limit';
import { decryptOAuthToken } from '@/lib/oauth-token-crypto';
import { API_KEY_PREFIX, hashApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const ACCESS_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

const DEBUG_OAUTH = process.env.DEBUG_OAUTH === '1' && process.env.NODE_ENV !== 'production';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_OAUTH) console.log(...args);
};

function oauthError(code: string, description: string, status = 400) {
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
  const text = await req.text().catch(() => '');
  if (text) {
    debugLog('[oauth/token] readForm fallback — content-type=%s body=%s', contentType, text.slice(0, 200));
    return Object.fromEntries(new URLSearchParams(text));
  }
  return {};
}

function generateRefreshToken(): string {
  return 'avrt_' + randomBytes(48).toString('base64url');
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── grant_type=authorization_code ──────────────────────────────────────────

async function handleAuthorizationCode(
  form: Record<string, string>,
  clientId: string,
) {
  const code = form.code;
  const redirect_uri = form.redirect_uri;

  if (!code || !redirect_uri) {
    return oauthError('invalid_request', 'Missing code or redirect_uri');
  }

  const code_hash = createHash('sha256').update(code).digest('hex');
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from('oauth_auth_codes')
    .select('code_hash, client_id, redirect_uri, plaintext_token, expires_at, consumed_at, code_challenge, code_challenge_method')
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
  if (row.client_id !== clientId) {
    debugLog('[oauth/token] REJECTED: client_id mismatch');
    return oauthError('invalid_grant', 'Code was not issued to this client');
  }
  if (row.redirect_uri !== redirect_uri) {
    debugLog('[oauth/token] REJECTED: redirect_uri mismatch');
    return oauthError('invalid_grant', 'redirect_uri does not match the authorization request');
  }

  // PKCE verification (OAuth 2.1)
  if (row.code_challenge) {
    const code_verifier = form.code_verifier;
    if (!code_verifier) {
      debugLog('[oauth/token] REJECTED: PKCE code_verifier missing');
      return oauthError('invalid_grant', 'code_verifier is required');
    }
    const method = row.code_challenge_method || 'S256';
    let computed: string;
    if (method === 'S256') {
      computed = createHash('sha256').update(code_verifier).digest('base64url');
    } else {
      computed = code_verifier;
    }
    if (computed !== row.code_challenge) {
      debugLog('[oauth/token] REJECTED: PKCE code_verifier mismatch');
      return oauthError('invalid_grant', 'code_verifier does not match code_challenge');
    }
  }

  if (!row.plaintext_token) {
    return oauthError('invalid_grant', 'Code unusable');
  }

  const accessToken = decryptOAuthToken(row.plaintext_token);

  // Atomically consume the code
  const { data: consumed } = await supabase
    .from('oauth_auth_codes')
    .update({ consumed_at: new Date().toISOString(), plaintext_token: null })
    .eq('code_hash', code_hash)
    .is('consumed_at', null)
    .select('code_hash');

  if (!consumed || consumed.length === 0) {
    return oauthError('invalid_grant', 'Code already used');
  }

  // Mint a refresh token and store its hash on the api_key row
  const refreshToken = generateRefreshToken();
  const rtHash = hashRefreshToken(refreshToken);

  const keyHash = hashApiKey(accessToken);
  await supabase
    .from('api_keys')
    .update({ refresh_token_hash: rtHash, oauth_client_id: clientId })
    .eq('key_hash', keyHash)
    .is('revoked_at', null);

  debugLog('[oauth/token] SUCCESS: token + refresh_token issued for client_id=%s', clientId);

  return NextResponse.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL,
  });
}

// ── grant_type=refresh_token ──────────────────────────────────────────────

async function handleRefreshToken(
  form: Record<string, string>,
  clientId: string,
) {
  const refreshToken = form.refresh_token;
  if (!refreshToken) {
    return oauthError('invalid_request', 'Missing refresh_token');
  }

  const rtHash = hashRefreshToken(refreshToken);
  const supabase = createServiceClient();

  // Look up the api_key that owns this refresh token
  const { data: key } = await supabase
    .from('api_keys')
    .select('id, company_id, user_id, oauth_client_id')
    .eq('refresh_token_hash', rtHash)
    .is('revoked_at', null)
    .single();

  if (!key) {
    debugLog('[oauth/token] REJECTED: unknown or revoked refresh_token');
    return oauthError('invalid_grant', 'Invalid refresh token');
  }

  if (key.oauth_client_id && key.oauth_client_id !== clientId) {
    debugLog('[oauth/token] REJECTED: refresh_token belongs to client %s, not %s', key.oauth_client_id, clientId);
    return oauthError('invalid_grant', 'Refresh token was not issued to this client');
  }

  // Mint a new access token
  const newAccessToken = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  const newKeyHash = hashApiKey(newAccessToken);
  const newKeyPrefix = newAccessToken.slice(0, 16);

  // Mint a new refresh token (rotation)
  const newRefreshToken = generateRefreshToken();
  const newRtHash = hashRefreshToken(newRefreshToken);

  // Insert the new api_key row
  const { error: insertErr } = await supabase
    .from('api_keys')
    .insert({
      company_id: key.company_id,
      user_id: key.user_id,
      label: 'Looker Studio (refreshed)',
      key_prefix: newKeyPrefix,
      key_hash: newKeyHash,
      source: 'oauth_client',
      oauth_client_id: clientId,
      refresh_token_hash: newRtHash,
    });

  if (insertErr) {
    console.error('[oauth/token] refresh insert error:', insertErr.message);
    return oauthError('server_error', 'Failed to issue new token', 500);
  }

  // Revoke the old api_key
  await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString(), refresh_token_hash: null })
    .eq('id', key.id);

  debugLog('[oauth/token] SUCCESS: refreshed token for client_id=%s', clientId);

  return NextResponse.json({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `oauth:token:${ipFromRequest(req)}`, limit: 10, windowSeconds: 60 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const form = await readForm(req);

  const grant_type = form.grant_type;
  const client_id = form.client_id;
  const client_secret = form.client_secret;

  debugLog('[oauth/token] grant_type=%s client_id=%s content-type=%s',
    grant_type, client_id, req.headers.get('content-type'));

  if (!client_id || !client_secret) {
    return oauthError('invalid_request', 'Missing client credentials');
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

  if (grant_type === 'authorization_code') {
    return handleAuthorizationCode(form, client_id);
  }

  if (grant_type === 'refresh_token') {
    return handleRefreshToken(form, client_id);
  }

  return oauthError('unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
