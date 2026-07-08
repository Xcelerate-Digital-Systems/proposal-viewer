// app/api/connectors/ghl/agency-connect/route.ts
//
// Store or update an agency-level GHL Private Integration Token for the
// Looker Studio connector. Validates the token by calling /locations/search.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { encryptGhlToken, decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { listLocations } from '@/lib/connectors/ghl/looker-client';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST — connect or update the agency token
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await authRateLimit(auth.companyId, 'connectors/ghl/agency-connect');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const { token: rawToken } = body as { token?: string };
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  // Validate by listing locations — agency tokens should be able to do this
  const validation = await listLocations(rawToken.trim());
  if (!validation.ok) {
    if (validation.status === 401) {
      return NextResponse.json({ error: 'Invalid token — GHL rejected it.' }, { status: 400 });
    }
    if (validation.status === 403) {
      return NextResponse.json(
        { error: 'Token does not have permission to list locations. Make sure you created an Agency-level Private Integration Token with Locations (Read) scope.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: validation.error || 'Could not validate token with GHL' },
      { status: 502 },
    );
  }

  const encrypted = encryptGhlToken(rawToken.trim());
  const locationCount = validation.data?.length || 0;

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('ghl_agency_connections')
    .select('id')
    .eq('company_id', auth.companyId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('ghl_agency_connections')
      .update({
        api_token_encrypted: encrypted,
        token_valid: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('[ghl/agency-connect] update:', error.message);
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('ghl_agency_connections')
      .insert({
        company_id: auth.companyId,
        api_token_encrypted: encrypted,
        token_valid: true,
      });

    if (error) {
      console.error('[ghl/agency-connect] insert:', error.message);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    data: { location_count: locationCount },
  });
}

// DELETE — disconnect the agency token
export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('ghl_agency_connections')
    .delete()
    .eq('company_id', auth.companyId);

  if (error) {
    console.error('[ghl/agency-connect] delete:', error.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET — check connection status
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: connection } = await supabase
    .from('ghl_agency_connections')
    .select('id, token_valid, last_used_at, created_at, updated_at')
    .eq('company_id', auth.companyId)
    .single();

  if (!connection) {
    return NextResponse.json({ success: true, data: { connected: false } });
  }

  // Optionally verify the token is still valid by listing locations.
  // Only mark invalid on a definitive 401 — not on rate limits, timeouts, etc.
  let locationCount = 0;
  if (connection.token_valid) {
    try {
      const token = decryptGhlToken(
        (await supabase
          .from('ghl_agency_connections')
          .select('api_token_encrypted')
          .eq('id', connection.id)
          .single()
        ).data!.api_token_encrypted,
      );
      const result = await listLocations(token);
      if (result.ok && result.data) {
        locationCount = result.data.length;
      } else if (result.status === 401) {
        console.error('[ghl/agency-connect] GET: token rejected by GHL (401)');
        await supabase
          .from('ghl_agency_connections')
          .update({ token_valid: false, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        connection.token_valid = false;
      }
      // Any other error (rate limit, timeout, 5xx) — don't mark invalid
    } catch {
      // Decrypt or network error — don't mark invalid
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      connected: true,
      token_valid: connection.token_valid,
      location_count: locationCount,
      last_used_at: connection.last_used_at,
      created_at: connection.created_at,
    },
  });
}
