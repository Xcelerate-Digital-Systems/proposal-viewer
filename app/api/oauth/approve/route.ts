// app/api/oauth/approve/route.ts
//
// Called by the /oauth/authorize consent page when the user clicks Approve.
// Requires a valid Supabase session. Validates client_id + redirect_uri,
// mints a long-lived api_keys row, and stashes the plaintext token behind a
// one-time code that the client will exchange at /api/oauth/token.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext, API_KEY_PREFIX, hashApiKey } from '@/lib/api-auth';
import { getOAuthClient, isRedirectUriAllowed } from '@/lib/oauth-clients/server';
import { encryptOAuthToken } from '@/lib/oauth-token-crypto';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CODE_TTL_SECONDS = 120;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'oauth/approve');
    if (limited) return limited;


    const body = await req.json().catch(() => ({}));
    const client_id = typeof body.client_id === 'string' ? body.client_id : '';
    const redirect_uri = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
    const state = typeof body.state === 'string' ? body.state : '';
    const scope = typeof body.scope === 'string' ? body.scope : null;
    const code_challenge = typeof body.code_challenge === 'string' ? body.code_challenge : null;
    const code_challenge_method = typeof body.code_challenge_method === 'string' ? body.code_challenge_method : null;

    if (!client_id || !redirect_uri) {
      return NextResponse.json({ error: 'client_id and redirect_uri are required' }, { status: 400 });
    }

    const client = await getOAuthClient(client_id);
    if (!client) {
      return NextResponse.json({ error: 'Unknown client_id' }, { status: 400 });
    }
    if (!isRedirectUriAllowed(redirect_uri, client)) {
      return NextResponse.json({ error: 'redirect_uri not allowed for this client' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Mint the long-lived token. Labelled with the client name so the user
    // can find it in Settings → API Keys.
    const plaintext = API_KEY_PREFIX + randomBytes(32).toString('base64url');
    const key_hash = hashApiKey(plaintext);
    const key_prefix = plaintext.slice(0, 16);

    // Re-authorization replaces the existing token for this (company, user,
    // client) instead of stacking another row in Settings. Without this every
    // re-auth piles up another permanent token even though the previous one is
    // about to be silently abandoned by the client.
    await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('company_id', auth.companyId)
      .eq('user_id', auth.member.user_id)
      .eq('source', 'oauth_client')
      .eq('label', client.name)
      .is('revoked_at', null);

    const { data: key, error: keyErr } = await supabase
      .from('api_keys')
      .insert({
        company_id: auth.companyId,
        user_id: auth.member.user_id,
        label: client.name,
        key_prefix,
        key_hash,
        source: 'oauth_client',
        oauth_client_id: client_id,
      })
      .select('id')
      .single();

    if (keyErr || !key) {
      console.error('[api/oauth/approve] POST key insert:', keyErr?.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const code = randomBytes(32).toString('base64url');
    const code_hash = createHash('sha256').update(code).digest('hex');
    const expires_at = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

    const { error: codeErr } = await supabase.from('oauth_auth_codes').insert({
      code_hash,
      client_id,
      redirect_uri,
      api_key_id: key.id,
      plaintext_token: encryptOAuthToken(plaintext),
      scope,
      code_challenge,
      code_challenge_method: code_challenge ? (code_challenge_method || 'S256') : null,
      expires_at,
    });

    if (codeErr) {
      await supabase.from('api_keys').delete().eq('id', key.id);
      console.error('[api/oauth/approve] POST code insert:', codeErr.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);

    if (process.env.DEBUG_OAUTH === '1') {
      console.log('[oauth/approve] code issued for client_id=%s redirect_uri=%s', client_id, redirect_uri);
    }

    return NextResponse.json({ success: true, redirect_to: redirect.toString() });
  } catch (err) {
    console.error('[api/oauth/approve] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
