// app/api/connectors/meta/accounts/route.ts
//
// Returns the ad accounts currently connected for the caller's company.
// Consumed by (a) the AgencyViz settings UI and (b) the Apps Script Looker
// connector during getConfig() to populate the ad-account dropdown.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const { data: connections, error: connErr } = await supabase
    .from('meta_connections')
    .select('id, meta_user_id, meta_user_name, status, expires_at, last_used_at, created_at')
    .eq('company_id', auth.companyId)
    .eq('status', 'active');

  if (connErr) {
    return NextResponse.json({ error: connErr.message }, { status: 500 });
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ success: true, data: { connections: [], accounts: [] } });
  }

  const connectionIds = connections.map((c) => c.id);
  const { data: accounts, error: accErr } = await supabase
    .from('meta_ad_accounts')
    .select('connection_id, ad_account_id, account_name, currency, timezone_name, business_name, enabled')
    .in('connection_id', connectionIds);

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: { connections, accounts: accounts ?? [] },
  });
}

/**
 * Toggle whether an individual ad account is exposed to the Looker Studio
 * connector. Scoped to the caller's company: the update only succeeds if the
 * connection row's company_id matches auth.companyId.
 */
export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { connection_id?: string; ad_account_id?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { connection_id, ad_account_id, enabled } = body;
  if (!connection_id || !ad_account_id || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'connection_id, ad_account_id, and enabled are required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Verify the connection belongs to this company before mutating the child row.
  const { data: connection, error: connErr } = await supabase
    .from('meta_connections')
    .select('id')
    .eq('id', connection_id)
    .eq('company_id', auth.companyId)
    .single();

  if (connErr || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from('meta_ad_accounts')
    .update({ enabled })
    .eq('connection_id', connection_id)
    .eq('ad_account_id', ad_account_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
