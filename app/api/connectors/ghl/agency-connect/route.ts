// app/api/connectors/ghl/agency-connect/route.ts
//
// Manage per-location GHL Private Integration Tokens for Looker Studio.
// Each location gets its own sub-account PIT.
//
// POST   — connect a location (validate token, store encrypted)
// DELETE — disconnect a location (?location_id=xxx)
// GET    — list connected locations for this company

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { encryptGhlToken, decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { testGhlConnection } from '@/lib/connectors/ghl/client';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST — connect a new location
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await authRateLimit(auth.companyId, 'connectors/ghl/agency-connect');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const { token: rawToken, location_name } = body as { token?: string; location_name?: string };
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }
  if (typeof location_name !== 'string' || !location_name.trim()) {
    return NextResponse.json({ error: 'location_name is required' }, { status: 400 });
  }

  // Validate the sub-account token by searching for its location
  const { ghlFetch } = await import('@/lib/connectors/ghl/client');
  const locResult = await ghlFetch<{ locations: Array<{ id: string; name: string }> }>(
    rawToken.trim(),
    '/locations/search',
    { method: 'GET' },
  );

  let locationId: string;
  if (locResult.ok && locResult.data?.locations?.length) {
    locationId = locResult.data.locations[0].id;
  } else if (locResult.status === 401) {
    return NextResponse.json({ error: 'Invalid token — GHL rejected it.' }, { status: 400 });
  } else {
    // Sub-account PITs typically can't call /locations/search (403).
    // Fall back to a contacts call to validate the token works.
    const fallback = await ghlFetch<unknown>(rawToken.trim(), '/contacts/', {
      method: 'GET',
      params: { limit: '1' },
    });
    if (fallback.status === 401) {
      return NextResponse.json({ error: 'Invalid token — GHL rejected it.' }, { status: 400 });
    }
    if (!fallback.ok) {
      return NextResponse.json(
        { error: fallback.error || 'Could not validate token with GHL' },
        { status: 400 },
      );
    }
    // Use a hash of the token as a stable ID since we can't detect the location
    const { createHash } = await import('crypto');
    locationId = 'loc_' + createHash('sha256').update(rawToken.trim()).digest('hex').slice(0, 16);
  }

  const encrypted = encryptGhlToken(rawToken.trim());
  const supabase = createServiceClient();

  // Upsert — if this location is already connected, update its token
  const { data: existing } = await supabase
    .from('ghl_looker_connections')
    .select('id')
    .eq('company_id', auth.companyId)
    .eq('location_id', locationId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('ghl_looker_connections')
      .update({
        api_token_encrypted: encrypted,
        location_name: location_name.trim(),
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
      .from('ghl_looker_connections')
      .insert({
        company_id: auth.companyId,
        location_id: locationId,
        location_name: location_name.trim(),
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
    data: { location_id: locationId, location_name: location_name.trim() },
  });
}

// DELETE — disconnect a location
export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('ghl_looker_connections')
    .delete()
    .eq('company_id', auth.companyId)
    .eq('location_id', locationId);

  if (error) {
    console.error('[ghl/agency-connect] delete:', error.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET — list connected locations
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: connections } = await supabase
    .from('ghl_looker_connections')
    .select('id, location_id, location_name, token_valid, last_used_at, created_at')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    success: true,
    data: {
      connected: (connections?.length ?? 0) > 0,
      locations: (connections || []).map((c) => ({
        location_id: c.location_id,
        location_name: c.location_name,
        token_valid: c.token_valid,
        last_used_at: c.last_used_at,
      })),
    },
  });
}
