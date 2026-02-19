// app/api/admin/accounts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySuperAdmin(req: NextRequest) {
  // Get the user's auth token from the request
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  // Check if they're a super admin
  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_super_admin', true)
    .single();

  return member;
}

// GET: List all companies with stats
export async function GET(req: NextRequest) {
  const admin = await verifySuperAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Fetch all companies
  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each company, get stats
  const companyIds = companies.map((c: { id: string }) => c.id);

  // Count proposals per company
  const { data: proposalCounts } = await supabaseAdmin
    .from('proposals')
    .select('company_id')
    .in('company_id', companyIds);

  // Count team members per company
  const { data: memberCounts } = await supabaseAdmin
    .from('team_members')
    .select('company_id')
    .in('company_id', companyIds);

  // Get most recent proposal activity per company
  const { data: recentActivity } = await supabaseAdmin
    .from('proposals')
    .select('company_id, updated_at')
    .in('company_id', companyIds)
    .order('updated_at', { ascending: false });

  // Build stats map
  const stats: Record<string, { proposals: number; members: number; lastActivity: string | null }> = {};
  for (const id of companyIds) {
    stats[id] = { proposals: 0, members: 0, lastActivity: null };
  }

  if (proposalCounts) {
    for (const row of proposalCounts) {
      stats[row.company_id].proposals++;
    }
  }

  if (memberCounts) {
    for (const row of memberCounts) {
      stats[row.company_id].members++;
    }
  }

  if (recentActivity) {
    const seen = new Set<string>();
    for (const row of recentActivity) {
      if (!seen.has(row.company_id)) {
        stats[row.company_id].lastActivity = row.updated_at;
        seen.add(row.company_id);
      }
    }
  }

  const result = companies.map((c: Record<string, unknown>) => ({
    ...c,
    stats: stats[c.id as string] || { proposals: 0, members: 0, lastActivity: null },
  }));

  return NextResponse.json(result);
}

// POST: Create a new company
export async function POST(req: NextRequest) {
  const admin = await verifySuperAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { name, slug } = await req.json();

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  // Check slug is unique
  const { data: existing } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
  }

  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .insert({ name, slug })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(company);
}