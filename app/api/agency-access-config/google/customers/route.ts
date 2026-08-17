import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';
import { decryptToken } from '@/lib/connectors/google/token-crypto';
import { fetchAccessibleCustomers, fetchCustomerDetails } from '@/lib/connectors/google/api-client';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { member, companyId } = auth;
    if (member.role !== 'owner' && member.role !== 'admin' && !member.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limited = await authRateLimit(companyId, 'agency-access-config');
    if (limited) return limited;

    // Diagnostic: check which step we reach
    const diag: Record<string, unknown> = { step: 'start', companyId };

    const supabase = createServiceClient();
    const { data: config } = await supabase
      .from('agency_access_config')
      .select('google_refresh_token_encrypted')
      .eq('company_id', companyId)
      .maybeSingle();

    diag.hasToken = !!config?.google_refresh_token_encrypted;
    if (!config?.google_refresh_token_encrypted) {
      return NextResponse.json({ error: 'Google not connected', ...diag }, { status: 404 });
    }

    let refreshToken: string;
    try {
      refreshToken = decryptToken(config.google_refresh_token_encrypted);
      diag.step = 'decrypted';
    } catch (e) {
      diag.step = 'decrypt_failed';
      diag.detail = e instanceof Error ? e.message : 'unknown';
      return NextResponse.json({ error: 'Failed to decrypt token', ...diag }, { status: 500 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    diag.envCheck = { clientId: !!clientId, clientSecret: !!clientSecret, devToken: !!devToken };

    if (!clientId || !clientSecret) {
      diag.step = 'missing_google_creds';
      return NextResponse.json({ error: 'Google not configured', ...diag }, { status: 500 });
    }
    if (!devToken) {
      diag.step = 'missing_dev_token';
      return NextResponse.json({ error: 'GOOGLE_ADS_DEVELOPER_TOKEN not set', ...diag }, { status: 500 });
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
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        diag.step = 'refresh_rejected';
        diag.refreshStatus = res.status;
        diag.refreshError = json;
        return NextResponse.json({ error: 'Token refresh rejected by Google', ...diag }, { status: 502 });
      }
      accessToken = json.access_token as string;
      diag.step = 'refreshed';
    } catch (e) {
      diag.step = 'refresh_exception';
      diag.detail = e instanceof Error ? e.message.slice(0, 200) : 'unknown';
      return NextResponse.json({ error: 'Failed to refresh Google token', ...diag }, { status: 502 });
    }

    let resourceNames: string[];
    try {
      resourceNames = await fetchAccessibleCustomers(accessToken);
      diag.step = 'listed_customers';
      diag.accessibleCount = resourceNames.length;
    } catch (e) {
      diag.step = 'list_failed';
      diag.detail = e instanceof Error ? e.message.slice(0, 500) : 'unknown';
      return NextResponse.json({ error: 'Failed to list accessible customers', ...diag }, { status: 502 });
    }

    const customerIds = resourceNames.map((r) => r.replace('customers/', ''));
    diag.customerIds = customerIds;

    const details = await Promise.all(
      customerIds.map(async (id) => {
        try {
          return await fetchCustomerDetails(accessToken, id);
        } catch {
          return null;
        }
      }),
    );

    const mccAccounts = details
      .filter((d): d is NonNullable<typeof d> => d !== null && d.manager === true)
      .map((d) => ({ id: d.id, name: d.descriptiveName }));

    diag.step = 'complete';
    diag.allDetails = details.map((d) => d ? { id: d.id, manager: d.manager, name: d.descriptiveName } : null);
    diag.mccCount = mccAccounts.length;

    return NextResponse.json({ customers: mccAccounts, _diag: diag });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : 'unknown';
    const stack = e instanceof Error ? e.stack?.slice(0, 300) : undefined;
    return NextResponse.json({ error: 'Unhandled exception', step: 'top_level', detail: msg, stack }, { status: 500 });
  }
}
