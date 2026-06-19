// app/api/connectors/meta/accounts/route.ts
//
// Returns the ad accounts currently connected for the caller's company.
// Consumed by (a) the AgencyViz settings UI and (b) the Apps Script Looker
// connector during getConfig() to populate the ad-account dropdown.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'connectors/meta/accounts');
    if (limited) return limited;


    const supabase = createServiceClient();

    const { data: connections, error: connErr } = await supabase
      .from('meta_connections')
      .select('id, meta_user_id, meta_user_name, status, expires_at, last_used_at, created_at')
      .eq('company_id', auth.companyId)
      .eq('status', 'active');

    if (connErr) {
      console.error('[api/connectors/meta/accounts] GET connections:', connErr.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      console.error('[api/connectors/meta/accounts] GET accounts:', accErr.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { connections, accounts: accounts ?? [] },
    });
  } catch (err) {
    console.error('[api/connectors/meta/accounts] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
