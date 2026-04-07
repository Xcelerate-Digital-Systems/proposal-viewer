// app/api/settings/api-keys/route.ts
//
// Manage personal access tokens used by the Agency Viz Chrome extension and
// other external integrations. Plaintext is shown to the user exactly once
// at creation; only the SHA-256 hash and a short prefix are stored.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { API_KEY_PREFIX, hashApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, key_prefix, last_used_at, created_at, revoked_at')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });

  // 32 bytes of entropy → 43-char base64url, prefixed for visual identification.
  const plaintext = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  const key_hash = hashApiKey(plaintext);
  const key_prefix = plaintext.slice(0, 16);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      company_id: auth.companyId,
      user_id: auth.member.user_id,
      label,
      key_prefix,
      key_hash,
    })
    .select('id, label, key_prefix, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // plaintext returned ONCE — never persisted in plaintext form
  return NextResponse.json({ success: true, data: { ...data, plaintext } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
