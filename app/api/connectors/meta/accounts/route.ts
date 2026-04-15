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
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const { data: connections, error: connErr } = await supabase
    .from('meta_connections')
    .select('id, meta_user_id, meta_user_name, status, expires_at')
    .eq('company_id', auth.companyId)
    .eq('status', 'active');

  // Temporary debug — remove once Phase 3 is confirmed working.
  const buildDebug = async () => ({
    resolved_company_id: auth.companyId,
    own_company_id: auth.member.company_id,
    is_super_admin: auth.member.is_super_admin ?? false,
    active_connections_query_result: connections,
    active_connections_query_error: connErr?.message ?? null,
    all_connections_for_this_company: (
      await supabase
        .from('meta_connections')
        .select('id, company_id, status')
        .eq('company_id', auth.companyId)
    ).data,
    all_connections_any_status: (
      await supabase
        .from('meta_connections')
        .select('id, company_id, status')
    ).data,
  });

  if (connErr) {
    return NextResponse.json({
      error: connErr.message,
      ...(debug ? { _debug: await buildDebug() } : {}),
    }, { status: 500 });
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        connections: [],
        accounts: [],
        ...(debug ? { _debug: await buildDebug() } : {}),
      },
    });
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
    data: {
      connections,
      accounts: accounts ?? [],
      ...(debug ? { _debug: await buildDebug() } : {}),
    },
  });
}
