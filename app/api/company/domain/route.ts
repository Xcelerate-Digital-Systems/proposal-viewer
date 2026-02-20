// app/api/company/domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

async function getAuthenticatedMember(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return member;
}

function resolveCompanyId(req: NextRequest, member: { company_id: string; is_super_admin?: boolean }): string {
  const overrideId = req.nextUrl.searchParams.get('company_id');
  if (overrideId && member.is_super_admin) {
    return overrideId;
  }
  return member.company_id;
}

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

/**
 * Check if a domain's DNS is actually configured and pointing to Vercel.
 * Vercel's "verified" flag only means ownership is confirmed (no other project claims it).
 * The /v6/domains/{domain}/config endpoint tells us if DNS is actually set up.
 * Returns { configured: boolean, misconfigured: boolean }
 */
async function checkDnsConfigured(domain: string): Promise<{ configured: boolean; misconfigured: boolean }> {
  try {
    const { ok, data } = await vercelFetch(`/v6/domains/${domain}/config`);
    if (!ok) {
      return { configured: false, misconfigured: true };
    }
    // misconfigured=false means DNS is properly pointing to Vercel
    return {
      configured: data.misconfigured === false,
      misconfigured: data.misconfigured !== false,
    };
  } catch {
    return { configured: false, misconfigured: true };
  }
}

// ─── GET — Get current domain status ────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = resolveCompanyId(req, member);
    const supabase = createServiceClient();

    const { data: company } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // If there's a domain set, check its current status on Vercel
    let vercel_status = null;
    if (company.custom_domain && VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      // Check ownership verification status
      const { ok, data } = await vercelFetch(
        `/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}`
      );

      if (ok) {
        // Check actual DNS configuration separately
        const dnsCheck = await checkDnsConfigured(company.custom_domain);

        // Domain is truly connected only when ownership is verified AND DNS points to Vercel
        const fullyConnected = (data.verified ?? false) && dnsCheck.configured;

        vercel_status = {
          verified: data.verified ?? false,
          dns_configured: dnsCheck.configured,
          fully_connected: fullyConnected,
          verification: data.verification || [],
        };

        // Sync to DB if status changed
        if (fullyConnected && !company.domain_verified) {
          await supabase
            .from('companies')
            .update({ domain_verified: true })
            .eq('id', companyId);
          company.domain_verified = true;
        } else if (!fullyConnected && company.domain_verified) {
          await supabase
            .from('companies')
            .update({ domain_verified: false })
            .eq('id', companyId);
          company.domain_verified = false;
        }
      }
    }

    // If domain exists but isn't verified, include DNS instructions
    let dns_instructions = null;
    if (company.custom_domain && !company.domain_verified) {
      dns_instructions = await fetchDnsInstructions(company.custom_domain);
    }

    return NextResponse.json({
      custom_domain: company.custom_domain,
      domain_verified: company.domain_verified,
      vercel_status,
      dns_instructions,
    });
  } catch (err) {
    console.error('Get domain error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — Add or update custom domain ─────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = resolveCompanyId(req, member);
    const isSuperAdminOverride = member.is_super_admin && companyId !== member.company_id;
    if (member.role !== 'owner' && !isSuperAdminOverride) {
      return NextResponse.json({ error: 'Only owners can manage custom domains' }, { status: 403 });
    }

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Domain management is not configured. Contact support.' },
        { status: 503 }
      );
    }

    const { domain } = await req.json();

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Basic domain format validation
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if this domain is already used by another company
    const { data: existing } = await supabase
      .from('companies')
      .select('id, name')
      .eq('custom_domain', domain)
      .neq('id', companyId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This domain is already in use by another account' }, { status: 409 });
    }

    // Get current company to check for existing domain
    const { data: company } = await supabase
      .from('companies')
      .select('custom_domain')
      .eq('id', companyId)
      .single();

    // If company already has a different domain, remove the old one from Vercel first
    if (company?.custom_domain && company.custom_domain !== domain) {
      await vercelFetch(
        `/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}`,
        { method: 'DELETE' }
      );
    }

    // Add the new domain to Vercel
    const { ok, status, data: vercelData } = await vercelFetch(
      `/v10/projects/${VERCEL_PROJECT_ID}/domains`,
      {
        method: 'POST',
        body: JSON.stringify({ name: domain }),
      }
    );

    if (!ok) {
      // Domain might already be on another Vercel project
      const errorMsg = vercelData?.error?.message || 'Failed to add domain to Vercel';
      console.error('Vercel add domain error:', vercelData);
      return NextResponse.json({ error: errorMsg }, { status });
    }

    // IMPORTANT: Never mark as verified on initial add.
    // Vercel's "verified" only means ownership, not DNS configuration.
    // The user must configure DNS and then click "Check DNS Configuration".
    const { error: dbError } = await supabase
      .from('companies')
      .update({
        custom_domain: domain,
        domain_verified: false, // Always start unverified — DNS hasn't been configured yet
      })
      .eq('id', companyId);

    if (dbError) {
      // Rollback: remove from Vercel if DB save failed
      await vercelFetch(
        `/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`,
        { method: 'DELETE' }
      );
      return NextResponse.json({ error: 'Failed to save domain' }, { status: 500 });
    }

    // Fetch the real DNS configuration from Vercel (unique CNAME target, etc.)
    const dnsInstructions = await fetchDnsInstructions(domain);

    return NextResponse.json({
      custom_domain: domain,
      domain_verified: false,
      verification: vercelData.verification || [],
      dns_instructions: dnsInstructions,
    });
  } catch (err) {
    console.error('Add domain error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE — Remove custom domain ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = resolveCompanyId(req, member);
    const isSuperAdminOverride = member.is_super_admin && companyId !== member.company_id;
    if (member.role !== 'owner' && !isSuperAdminOverride) {
      return NextResponse.json({ error: 'Only owners can manage custom domains' }, { status: 403 });
    }

    const supabase = createServiceClient();

    const { data: company } = await supabase
      .from('companies')
      .select('custom_domain')
      .eq('id', companyId)
      .single();

    if (!company?.custom_domain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 404 });
    }

    // Remove from Vercel
    if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      await vercelFetch(
        `/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}`,
        { method: 'DELETE' }
      );
    }

    // Clear from database
    const { error: dbError } = await supabase
      .from('companies')
      .update({ custom_domain: null, domain_verified: false })
      .eq('id', companyId);

    if (dbError) {
      return NextResponse.json({ error: 'Failed to remove domain' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Remove domain error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch real DNS configuration from Vercel's config endpoint.
 * Returns the actual CNAME target or A record IP that Vercel assigns,
 * NOT hardcoded values (Vercel assigns unique CNAME targets per domain).
 */
async function fetchDnsInstructions(domain: string) {
  try {
    const { ok, data } = await vercelFetch(`/v6/domains/${domain}/config`);

    if (!ok) {
      // Fallback to generic instructions if config endpoint fails
      return buildFallbackDnsInstructions(domain);
    }

    const parts = domain.split('.');
    const isSubdomain = parts.length > 2;

    if (isSubdomain) {
      // For subdomains, use the recommended CNAME from Vercel
      const subdomain = parts.slice(0, -2).join('.');
      const cnameValue = data.recommendedCNAME?.[0]?.value || 'cname.vercel-dns.com';

      return {
        type: 'CNAME',
        name: subdomain,
        value: cnameValue,
        instructions: `Add a CNAME record for "${subdomain}" pointing to "${cnameValue}" in your DNS provider.`,
      };
    } else {
      // For apex domains, use the recommended A record IP from Vercel
      const ipValue = data.recommendedIPv4?.[0]?.value?.[0] || '76.76.21.21';

      return {
        type: 'A',
        name: '@',
        value: ipValue,
        instructions: `Add an A record for "@" pointing to "${ipValue}" in your DNS provider.`,
      };
    }
  } catch {
    return buildFallbackDnsInstructions(domain);
  }
}

/**
 * Fallback DNS instructions if Vercel config endpoint is unavailable.
 */
function buildFallbackDnsInstructions(domain: string) {
  const parts = domain.split('.');
  const isSubdomain = parts.length > 2;

  if (isSubdomain) {
    const subdomain = parts.slice(0, -2).join('.');
    return {
      type: 'CNAME',
      name: subdomain,
      value: 'cname.vercel-dns.com',
      instructions: `Add a CNAME record for "${subdomain}" pointing to "cname.vercel-dns.com" in your DNS provider.`,
    };
  } else {
    return {
      type: 'A',
      name: '@',
      value: '76.76.21.21',
      instructions: `Add an A record for "@" pointing to "76.76.21.21" in your DNS provider.`,
    };
  }
}