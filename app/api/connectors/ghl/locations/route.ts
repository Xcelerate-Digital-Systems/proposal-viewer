// app/api/connectors/ghl/locations/route.ts
//
// Returns connected GHL locations for this company. Used by the Apps
// Script Looker connector during getConfig() to populate the location
// picker dropdown. Now reads from ghl_looker_connections (per-location
// tokens) instead of calling GHL's API.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data: connections } = await supabase
      .from('ghl_looker_connections')
      .select('location_id, location_name, token_valid')
      .eq('company_id', auth.companyId)
      .eq('token_valid', true)
      .order('created_at', { ascending: true });

    const locations = (connections || []).map((c) => ({
      id: c.location_id,
      name: c.location_name,
    }));

    return NextResponse.json({
      success: true,
      data: { locations, connected: locations.length > 0 },
    });
  } catch (err) {
    console.error('[api/connectors/ghl/locations] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
