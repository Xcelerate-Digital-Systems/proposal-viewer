// GET /api/settings/ghl/status
// Connection status + recent sync activity.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: conn } = await supabase
      .from('ghl_connections')
      .select('id, location_id, location_name, pipeline_id, pipeline_name, workflow_id, workflow_enabled, sync_monetary_value, enabled, token_valid, created_at, updated_at')
      .eq('company_id', auth.companyId)
      .maybeSingle();

    // Recent sync jobs (last 20)
    const { data: recentJobs } = await supabase
      .from('ghl_sync_jobs')
      .select('id, entity_type, entity_id, event_type, from_stage, to_stage, status, attempts, last_error, created_at, completed_at')
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Count by status
    const { data: statusCounts } = await supabase
      .from('ghl_sync_jobs')
      .select('status')
      .eq('company_id', auth.companyId);

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };
    (statusCounts || []).forEach(row => {
      const s = row.status as keyof typeof counts;
      if (s in counts) counts[s]++;
    });

    return NextResponse.json({
      success: true,
      data: {
        connection: conn,
        recentJobs: recentJobs || [],
        jobCounts: counts,
      },
    });
  } catch (err) {
    console.error('[api/settings/ghl/status] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
