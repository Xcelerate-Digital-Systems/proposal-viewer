// app/api/ads/client/[clientId]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * POST /api/ads/client/[clientId]/share
 * Generate or return the existing public share token for this client's ad tracker view.
 *
 * DELETE /api/ads/client/[clientId]/share
 * Revoke the token (set null).
 */

async function verifyAgencyOwnsClient(req: NextRequest, clientId: string) {
  const auth = await getAuthContext(req);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from('companies')
    .select('id, agency_id, account_type, ad_tracker_share_token')
    .eq('id', clientId)
    .eq('account_type', 'client')
    .single();

  if (!client) {
    return { error: NextResponse.json({ error: 'Client not found' }, { status: 404 }) };
  }

  const isSuperAdmin = auth.member.is_super_admin;
  const isOwnAgency =
    (auth.member.role === 'owner' || auth.member.role === 'admin') &&
    client.agency_id === auth.member.company_id;

  if (!isSuperAdmin && !isOwnAgency) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { client, supabase };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const check = await verifyAgencyOwnsClient(req, params.clientId);
  if ('error' in check) return check.error;

  const { client, supabase } = check;
  const existing = (client as { ad_tracker_share_token: string | null }).ad_tracker_share_token;
  const newToken = existing || crypto.randomUUID();

  if (!existing) {
    const { error } = await supabase
      .from('companies')
      .update({ ad_tracker_share_token: newToken })
      .eq('id', params.clientId);
    if (error) {
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }
  }

  return NextResponse.json({ token: newToken });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const check = await verifyAgencyOwnsClient(req, params.clientId);
  if ('error' in check) return check.error;

  const { supabase } = check;
  const { error } = await supabase
    .from('companies')
    .update({ ad_tracker_share_token: null })
    .eq('id', params.clientId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
  }

  return NextResponse.json({ revoked: true });
}
