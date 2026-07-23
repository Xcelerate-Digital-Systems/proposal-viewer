// Dynamic Client Registration (RFC 7591) — required by MCP OAuth spec.
// MCP clients (Claude Code, etc.) auto-register themselves before starting
// the OAuth authorization flow.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { hashSecret } from '@/lib/oauth-clients/server';
import { rateLimit, ipFromRequest } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `oauth:register:${ipFromRequest(req)}`, limit: 5, windowSeconds: 60 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name : 'MCP Client';
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === 'string') : [];

  if (redirectUris.length === 0) {
    return NextResponse.json({ error: 'redirect_uris is required' }, { status: 400 });
  }

  const clientId = `mcp_${randomBytes(16).toString('hex')}`;
  const clientSecret = `avcs_${randomBytes(32).toString('base64url')}`;
  const clientSecretHash = hashSecret(clientSecret);

  const sb = createServiceClient();
  const { error } = await sb.from('oauth_clients').insert({
    client_id: clientId,
    client_secret_hash: clientSecretHash,
    name: clientName,
    redirect_uris: redirectUris,
    source: 'dynamic_registration',
  });

  if (error) {
    console.error('[oauth/register] insert error:', error.message);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }

  return NextResponse.json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  }, {
    status: 201,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
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
