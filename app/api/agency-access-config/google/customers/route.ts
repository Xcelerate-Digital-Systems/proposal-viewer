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
    } catch (e) {
      return NextResponse.json({ error: 'decrypt_failed', detail: (e as Error).message }, { status: 500 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

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
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        return NextResponse.json({ error: 'refresh_rejected', status: res.status, google: json }, { status: 502 });
      }
      accessToken = json.access_token as string;
    } catch (e) {
      return NextResponse.json({ error: 'refresh_exception', detail: (e as Error).message }, { status: 502 });
    }

    if (!devToken) {
      return NextResponse.json({ error: 'GOOGLE_ADS_DEVELOPER_TOKEN not set' }, { status: 500 });
    }

    let resourceNames: string[];
    try {
      resourceNames = await fetchAccessibleCustomers(accessToken);
    } catch (e) {
      const err = e as Error & { status?: number; googleError?: unknown };
      return NextResponse.json({
        error: 'list_failed',
        detail: err.message?.slice(0, 800),
      }, { status: 502 });
    }

    const customerIds = resourceNames.map((r) => r.replace('customers/', ''));

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

    return NextResponse.json({ customers: mccAccounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : 'unknown';
    return NextResponse.json({ error: 'Unhandled exception', detail: msg }, { status: 500 });
  }
}
