import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';
import { decryptToken } from '@/lib/connectors/google/token-crypto';
import { fetchAccessibleCustomers, fetchCustomerDetails } from '@/lib/connectors/google/api-client';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { member, companyId } = auth;
  if (member.role !== 'owner' && member.role !== 'admin' && !member.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limited = await authRateLimit(companyId, 'agency-access-config');
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data: config } = await supabase
    .from('agency_access_config')
    .select('google_refresh_token_encrypted')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!config?.google_refresh_token_encrypted) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 404 });
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(config.google_refresh_token_encrypted);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt token' }, { status: 500 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google not configured' }, { status: 500 });
  }

  let accessToken: string;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error_description || json.error || 'refresh failed');
    accessToken = json.access_token;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'unknown';
    console.error('[agency-access-config/google/customers] refresh failed:', msg);
    return NextResponse.json({ error: 'Failed to refresh Google token' }, { status: 502 });
  }

  try {
    const resourceNames = await fetchAccessibleCustomers(accessToken);
    const customerIds = resourceNames.map((r) => r.replace('customers/', ''));
    console.log(`[google/customers] accessible customers: ${customerIds.length}`, customerIds);

    const details = await Promise.all(
      customerIds.map((id) =>
        fetchCustomerDetails(accessToken, id).catch((err) => {
          console.error(`[google/customers] fetchCustomerDetails(${id}) failed:`, err instanceof Error ? err.message : err);
          return null;
        }),
      ),
    );

    console.log('[google/customers] details:', details.map((d) => d ? `${d.id} manager=${d.manager} "${d.descriptiveName}"` : 'null'));

    const mccAccounts = details
      .filter((d): d is NonNullable<typeof d> => d !== null && d.manager === true)
      .map((d) => ({ id: d.id, name: d.descriptiveName }));

    console.log(`[google/customers] MCC accounts found: ${mccAccounts.length}`);
    return NextResponse.json({ customers: mccAccounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'unknown';
    console.error('[agency-access-config/google/customers]', msg);
    return NextResponse.json({ error: 'Failed to fetch Google Ads accounts' }, { status: 502 });
  }
}
