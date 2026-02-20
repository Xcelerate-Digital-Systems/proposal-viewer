// app/api/company/domain/verify/route.ts
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

// POST — Trigger domain verification check on Vercel
export async function POST(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = resolveCompanyId(req, member);

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

    // Already verified
    if (company.domain_verified) {
      return NextResponse.json({
        verified: true,
        custom_domain: company.custom_domain,
      });
    }

    // Ask Vercel to verify the domain
    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}/verify${teamParam}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await res.json().catch(() => ({}));

    if (data.verified) {
      // Update DB
      await supabase
        .from('companies')
        .update({ domain_verified: true })
        .eq('id', companyId);

      return NextResponse.json({
        verified: true,
        custom_domain: company.custom_domain,
      });
    }

    return NextResponse.json({
      verified: false,
      custom_domain: company.custom_domain,
      verification: data.verification || [],
    });
  } catch (err) {
    console.error('Verify domain error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}