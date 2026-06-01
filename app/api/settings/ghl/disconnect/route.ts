// DELETE /api/settings/ghl/disconnect
// Disable GHL sync and clear the token. Preserves ghl_opportunity_id references.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || (auth.member?.role !== 'owner' && auth.member?.role !== 'admin' && !auth.member?.is_super_admin)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit({ key: `ghl:disconnect:${auth.companyId}`, limit: 5, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 5) });
    }

    const supabase = createServiceClient();

    // Delete the connection (cascades to ghl_stage_mappings)
    const { error } = await supabase
      .from('ghl_connections')
      .delete()
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/settings/ghl/disconnect] DELETE:', error.message);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    // Cancel any pending sync jobs
    await supabase
      .from('ghl_sync_jobs')
      .update({ status: 'dead', last_error: 'Connection disconnected' })
      .eq('company_id', auth.companyId)
      .in('status', ['pending', 'failed']);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/settings/ghl/disconnect] DELETE:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
