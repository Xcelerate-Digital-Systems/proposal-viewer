// POST /api/settings/ghl/connect
// Validate a GHL private integration token, encrypt and store it.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { encryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { listPipelines } from '@/lib/connectors/ghl/opportunities';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface ConnectBody {
  api_token: string;
  location_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || (auth.member?.role !== 'owner' && auth.member?.role !== 'admin' && !auth.member?.is_super_admin)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await authRateLimit(auth.companyId, 'settings/ghl/connect');
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!body.api_token || typeof body.api_token !== 'string') {
      return NextResponse.json({ error: 'api_token is required' }, { status: 400 });
    }
    if (!body.location_id || typeof body.location_id !== 'string') {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 });
    }

    // Validate token + location by fetching pipelines (location-scoped endpoint)
    const pipelinesResult = await listPipelines(body.api_token, body.location_id);
    if (!pipelinesResult.ok) {
      const msg =
        pipelinesResult.status === 401
          ? 'Invalid API token. Make sure you copied the full token from your Private Integration.'
          : pipelinesResult.status === 403
            ? 'Token does not have access to this location. Check your scopes include Opportunities (Read/Write).'
            : pipelinesResult.status === 422
              ? 'Location ID not found. Double-check the ID in GHL → Settings → Business Profile.'
              : `Connection failed: ${pipelinesResult.error}`;
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const encrypted = encryptGhlToken(body.api_token);
    const supabase = createServiceClient();

    // Upsert connection (one per company)
    const { data, error } = await supabase
      .from('ghl_connections')
      .upsert(
        {
          company_id: auth.companyId,
          api_token_encrypted: encrypted,
          location_id: body.location_id,
          pipeline_id: pipelinesResult.data!.pipelines[0]?.id || '',
          pipeline_name: pipelinesResult.data!.pipelines[0]?.name || null,
          token_valid: true,
          enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      )
      .select('id, location_id, pipeline_id, pipeline_name, enabled')
      .single();

    if (error) {
      console.error('[api/settings/ghl/connect] POST:', error.message);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        connection: data,
        pipelines: pipelinesResult.data!.pipelines,
      },
    });
  } catch (err) {
    console.error('[api/settings/ghl/connect] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
