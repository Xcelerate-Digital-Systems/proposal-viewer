// app/api/clients/[clientId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * GET /api/clients/[clientId]
 * Returns a single client company belonging to the caller's agency.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const { data: client, error } = await supabase
    .from('companies')
    .select('id, name, slug, logo_url, agency_id, account_type, ad_tracker_share_token')
    .eq('id', params.clientId)
    .eq('account_type', 'client')
    .single();

  if (error || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Super admin always allowed; otherwise caller must be an admin/owner of the
  // agency this client belongs to.
  const isSuperAdmin = auth.member.is_super_admin;
  const isOwnAgency =
    (auth.member.role === 'owner' || auth.member.role === 'admin') &&
    client.agency_id === auth.member.company_id;

  if (!isSuperAdmin && !isOwnAgency) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(client);
}
