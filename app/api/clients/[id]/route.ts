import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

const supabaseAdmin = createServiceClient();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { member, companyId } = auth;

  const isSuperAdmin = !!member.is_super_admin;
  const isOwnerOrAdmin = member.role === 'owner' || member.role === 'admin';

  if (!isSuperAdmin && !isOwnerOrAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const agencyId = isSuperAdmin ? companyId : (member.company_id as string);

  if (!isSuperAdmin) {
    const { data: ownCompany } = await supabaseAdmin
      .from('companies')
      .select('account_type')
      .eq('id', agencyId)
      .single();

    if (ownCompany?.account_type !== 'agency') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const limited = await authRateLimit(agencyId, 'clients');
  if (limited) return limited;

  const { id: clientId } = await params;

  const { data: client } = await supabaseAdmin
    .from('companies')
    .select('id, agency_id, account_type')
    .eq('id', clientId)
    .single();

  if (!client || client.account_type !== 'client' || client.agency_id !== agencyId) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('companies')
    .delete()
    .eq('id', clientId);

  if (error) {
    console.error('[api/clients] DELETE:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
