// POST — Save a Figma personal access token (encrypted).
// DELETE — Remove a Figma connection.
// GET — List Figma connections for this company.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { encryptFigmaToken } from '@/lib/connectors/figma/token-crypto';
import { validateToken } from '@/lib/connectors/figma/api';

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { personalAccessToken } = await req.json();
  if (!personalAccessToken || typeof personalAccessToken !== 'string') {
    return NextResponse.json({ error: 'personalAccessToken is required' }, { status: 400 });
  }

  const validation = await validateToken(personalAccessToken.trim());
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid Figma token. Check that you pasted the full token from Figma settings.' }, { status: 400 });
  }

  const encrypted = encryptFigmaToken(personalAccessToken.trim());
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('figma_connections')
    .upsert(
      {
        company_id: auth.companyId,
        team_member_id: auth.member.id,
        figma_user_id: validation.userId!,
        figma_handle: validation.handle || null,
        figma_email: validation.email || null,
        access_token_encrypted: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,team_member_id' },
    )
    .select('id, figma_handle, figma_email, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createServiceClient();

  await sb
    .from('figma_connections')
    .delete()
    .eq('company_id', auth.companyId)
    .eq('team_member_id', auth.member.id);

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createServiceClient();

  const { data: connections } = await sb
    .from('figma_connections')
    .select('id, figma_handle, figma_email, team_member_id, created_at, updated_at')
    .eq('company_id', auth.companyId);

  return NextResponse.json({ success: true, data: connections || [] });
}
