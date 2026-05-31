// DELETE /api/settings/ghl/disconnect
// Disable GHL sync and clear the token. Preserves ghl_opportunity_id references.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || (auth.member?.role !== 'owner' && auth.member?.role !== 'admin' && !auth.member?.is_super_admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Delete the connection (cascades to ghl_stage_mappings)
  const { error } = await supabase
    .from('ghl_connections')
    .delete()
    .eq('company_id', auth.companyId);

  if (error) {
    console.error('[api/settings/ghl/disconnect]', error.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  // Cancel any pending sync jobs
  await supabase
    .from('ghl_sync_jobs')
    .update({ status: 'dead', last_error: 'Connection disconnected' })
    .eq('company_id', auth.companyId)
    .in('status', ['pending', 'failed']);

  return NextResponse.json({ success: true });
}
