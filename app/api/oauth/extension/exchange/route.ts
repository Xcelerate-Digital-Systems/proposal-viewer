// app/api/oauth/extension/exchange/route.ts
//
// Exchanges a one-time code (from /oauth/extension/authorize) for the
// long-lived plaintext API token. No session auth required — the code itself
// is the credential. Codes are single-use and expire after ~2 minutes.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest } from '@/lib/rate-limit';
import { decryptOAuthToken } from '@/lib/oauth-token-crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit({ key: `oauth:ext-exchange:${ipFromRequest(req)}`, limit: 10, windowSeconds: 60 });
    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });

    const code_hash = createHash('sha256').update(code).digest('hex');
    const supabase = createServiceClient();

    const { data: row, error } = await supabase
      .from('oauth_extension_codes')
      .select('code_hash, plaintext_token, expires_at, consumed_at')
      .eq('code_hash', code_hash)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    if (row.consumed_at) {
      return NextResponse.json({ error: 'Code already used' }, { status: 400 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 });
    }
    if (!row.plaintext_token) {
      return NextResponse.json({ error: 'Code unusable' }, { status: 400 });
    }

    const token = decryptOAuthToken(row.plaintext_token);

    // Atomically consume: wipe the plaintext and stamp consumed_at. If the
    // update affects 0 rows, someone else raced us and we must not return.
    const { data: consumed, error: consumeErr } = await supabase
      .from('oauth_extension_codes')
      .update({ consumed_at: new Date().toISOString(), plaintext_token: null })
      .eq('code_hash', code_hash)
      .is('consumed_at', null)
      .select('code_hash');

    if (consumeErr || !consumed || consumed.length === 0) {
      return NextResponse.json({ error: 'Code already used' }, { status: 400 });
    }

    return NextResponse.json({ success: true, token });
  } catch (err) {
    console.error('[api/oauth/extension/exchange] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
