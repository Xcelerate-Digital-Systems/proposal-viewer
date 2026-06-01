// app/api/oauth/extension/authorize/route.ts
//
// Called by the in-app consent screen once the user clicks "Approve". Requires
// a valid Supabase session (Authorization: Bearer <access_token>). Creates a
// long-lived api_keys row for the Chrome extension and a short-lived one-time
// code that the extension will swap for the plaintext token.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext, API_KEY_PREFIX, hashApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const CODE_TTL_SECONDS = 120;
const DEFAULT_LABEL = 'Chrome Extension';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const label =
      typeof body.label === 'string' && body.label.trim() ? body.label.trim() : DEFAULT_LABEL;

    // Mint the long-lived token (same shape as /api/settings/api-keys).
    const plaintext = API_KEY_PREFIX + randomBytes(32).toString('base64url');
    const key_hash = hashApiKey(plaintext);
    const key_prefix = plaintext.slice(0, 16);

    const supabase = createServiceClient();

    // Re-authorization (e.g. user reinstalls the extension on a new machine)
    // revokes prior tokens for this (company, user, label) so the Connected
    // Apps list stays at one row per integration instead of accreting forever.
    await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('company_id', auth.companyId)
      .eq('user_id', auth.member.user_id)
      .eq('source', 'oauth_extension')
      .eq('label', label)
      .is('revoked_at', null);

    const { data: key, error: keyErr } = await supabase
      .from('api_keys')
      .insert({
        company_id: auth.companyId,
        user_id: auth.member.user_id,
        label,
        key_prefix,
        key_hash,
        source: 'oauth_extension',
      })
      .select('id')
      .single();

    if (keyErr || !key) {
      console.error('[api/oauth/extension/authorize] POST key insert:', keyErr?.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Mint the short-lived one-time code. The plaintext token is stashed on the
    // code row so that the exchange endpoint can return it without re-deriving.
    const code = randomBytes(32).toString('base64url');
    const code_hash = createHash('sha256').update(code).digest('hex');
    const expires_at = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

    const { error: codeErr } = await supabase.from('oauth_extension_codes').insert({
      code_hash,
      api_key_id: key.id,
      plaintext_token: plaintext,
      expires_at,
    });

    if (codeErr) {
      // Roll back the half-provisioned key so it can't be used silently.
      await supabase.from('api_keys').delete().eq('id', key.id);
      console.error('[api/oauth/extension/authorize] POST code insert:', codeErr.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, code, expires_in: CODE_TTL_SECONDS });
  } catch (err) {
    console.error('[api/oauth/extension/authorize] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
