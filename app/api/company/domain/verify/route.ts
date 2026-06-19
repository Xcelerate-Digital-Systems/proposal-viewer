// app/api/company/domain/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

/**
 * Helper to call the Vercel API
 */
async function vercelFetch(path: string, options: RequestInit = {}) {
  const url = new URL(path, 'https://api.vercel.com');
  if (VERCEL_TEAM_ID) {
    url.searchParams.set('teamId', VERCEL_TEAM_ID);
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// POST — Trigger domain verification check on Vercel
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await authRateLimit(auth.companyId, 'company/domain/verify');
    if (limited) return limited;


    const { companyId } = auth;

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Domain management is not configured' },
        { status: 503 }
      );
    }

    const supabase = createServiceClient();

    const { data: company } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();

    if (!company?.custom_domain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 404 });
    }

    // Step 1: Ask Vercel to verify ownership (in case a TXT record was needed)
    const verifyRes = await vercelFetch(
      `/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}/verify`,
      { method: 'POST' }
    );
    const verifyData = verifyRes.data;

    // If ownership isn't verified yet, return the verification challenges
    if (!verifyData.verified) {
      return NextResponse.json({
        verified: false,
        custom_domain: company.custom_domain,
        verification: verifyData.verification || [],
        message: 'Domain ownership not yet verified. Please add the required TXT record.',
      });
    }

    // Step 2: Ownership is verified — now check if DNS is actually configured
    // The /v6/domains/{domain}/config endpoint tells us if DNS points to Vercel
    const configRes = await vercelFetch(`/v6/domains/${company.custom_domain}/config`);
    const dnsConfigured = configRes.ok && configRes.data.misconfigured === false;

    if (dnsConfigured) {
      // Both ownership AND DNS are good — mark as fully verified
      await supabase
        .from('companies')
        .update({ domain_verified: true })
        .eq('id', companyId);

      return NextResponse.json({
        verified: true,
        custom_domain: company.custom_domain,
      });
    }

    // Ownership verified but DNS not pointing to Vercel yet
    return NextResponse.json({
      verified: false,
      custom_domain: company.custom_domain,
      verification: [],
      message: 'Domain ownership verified, but DNS is not yet pointing to Vercel. Please add the required DNS record and allow time for propagation.',
    });
  } catch (err) {
    console.error('Verify domain error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}