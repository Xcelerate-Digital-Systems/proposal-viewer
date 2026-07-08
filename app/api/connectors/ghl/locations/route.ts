// app/api/connectors/ghl/locations/route.ts
//
// Returns GHL locations (sub-accounts) available to the agency's token.
// Consumed by the Apps Script Looker connector during getConfig() to
// populate the location picker dropdown.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { listLocations } from '@/lib/connectors/ghl/looker-client';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'connectors/ghl/locations');
    if (limited) return limited;

    const supabase = createServiceClient();
    const { data: connection } = await supabase
      .from('ghl_agency_connections')
      .select('id, api_token_encrypted, token_valid')
      .eq('company_id', auth.companyId)
      .single();

    if (!connection) {
      return NextResponse.json({
        success: true,
        data: { locations: [], connected: false },
      });
    }

    if (!connection.token_valid) {
      return NextResponse.json(
        { error: 'GHL agency token is invalid. Reconnect at Integrations → Looker Studio.', ghl_token_invalid: true },
        { status: 502 },
      );
    }

    let token: string;
    try {
      token = decryptGhlToken(connection.api_token_encrypted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'decrypt failed';
      return NextResponse.json({ error: `Token decrypt failed: ${msg}` }, { status: 500 });
    }

    const result = await listLocations(token);

    if (!result.ok) {
      if (result.status === 401) {
        await supabase
          .from('ghl_agency_connections')
          .update({ token_valid: false, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        return NextResponse.json(
          { error: 'GHL token is invalid or expired. Reconnect at Integrations → Looker Studio.', ghl_token_invalid: true },
          { status: 502 },
        );
      }
      return NextResponse.json({ error: result.error || 'GHL API error' }, { status: 502 });
    }

    // Fire-and-forget last_used_at update
    supabase
      .from('ghl_agency_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connection.id)
      .then(() => {});

    return NextResponse.json({
      success: true,
      data: { locations: result.data || [], connected: true },
    });
  } catch (err) {
    console.error('[api/connectors/ghl/locations] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
