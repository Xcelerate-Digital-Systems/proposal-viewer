// app/api/connectors/meta/health/route.ts
//
// Returns the latest Meta API health check result for the integrations UI.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('integration_health')
    .select('status, pinned_version, latest_version, details, checked_at')
    .eq('connector', 'meta')
    .single();

  if (!data) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data });
}
