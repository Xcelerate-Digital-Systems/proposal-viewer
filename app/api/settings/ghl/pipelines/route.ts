// GET /api/settings/ghl/pipelines
// Proxy to GHL pipelines endpoint for the connected location.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { listPipelines } from '@/lib/connectors/ghl/opportunities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: conn } = await supabase
    .from('ghl_connections')
    .select('api_token_encrypted, location_id')
    .eq('company_id', auth.companyId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: 'No GHL connection configured' }, { status: 404 });
  }

  const token = decryptGhlToken(conn.api_token_encrypted);
  const result = await listPipelines(token, conn.location_id);

  if (!result.ok) {
    if (result.status === 401) {
      await supabase
        .from('ghl_connections')
        .update({ token_valid: false })
        .eq('company_id', auth.companyId);
    }
    return NextResponse.json(
      { error: result.error || 'Failed to fetch pipelines' },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
