// app/api/connectors/ghl/custom-fields/route.ts
//
// Returns custom field definitions for a GHL location. Used by the Apps
// Script connector to build a dynamic schema that includes custom fields.
// Looks up the per-location token from ghl_looker_connections.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { listCustomFields } from '@/lib/connectors/ghl/looker-client';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'connectors/ghl/custom-fields');
    if (limited) return limited;

    const locationId = req.nextUrl.searchParams.get('location_id');
    if (!locationId) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 });
    }

    const model = req.nextUrl.searchParams.get('model') || undefined;

    const supabase = createServiceClient();
    const { data: connection } = await supabase
      .from('ghl_looker_connections')
      .select('id, api_token_encrypted, token_valid')
      .eq('company_id', auth.companyId)
      .eq('location_id', locationId)
      .single();

    if (!connection || !connection.token_valid) {
      return NextResponse.json({ error: 'No active GHL connection for this location' }, { status: 404 });
    }

    let token: string;
    try {
      token = decryptGhlToken(connection.api_token_encrypted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'decrypt failed';
      return NextResponse.json({ error: `Token decrypt failed: ${msg}` }, { status: 500 });
    }

    // Fetch both models when no specific model is requested (unified schema)
    const models = model ? [model] : ['opportunity', 'contact'];
    const allFields: { id: string; name: string; dataType: string }[] = [];
    const seenIds = new Set<string>();

    for (const m of models) {
      const result = await listCustomFields(token, locationId, m);
      if (!result.ok) {
        if (result.status === 401) {
          await supabase
            .from('ghl_looker_connections')
            .update({ token_valid: false, updated_at: new Date().toISOString() })
            .eq('id', connection.id);
          return NextResponse.json(
            { error: 'GHL token is invalid. Reconnect at Integrations → Looker Studio.', ghl_token_invalid: true },
            { status: 502 },
          );
        }
        continue;
      }
      for (const cf of result.data || []) {
        if (!seenIds.has(cf.id)) {
          seenIds.add(cf.id);
          allFields.push(cf);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { custom_fields: allFields },
    });
  } catch (err) {
    console.error('[api/connectors/ghl/custom-fields] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
