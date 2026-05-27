// app/api/admin/accounts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// Use the shared no-store-fetch service client. The bare createClient()
// allows Next.js's Data Cache to cache PostgREST GETs, which has previously
// caused stale-auth bugs in this codebase.
const supabaseAdmin = createServiceClient();

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  // A user can have rows in multiple companies; pick the first super-admin
  // row if any.
  const { data: members } = await supabaseAdmin
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_super_admin', true)
    .limit(1);

  return members?.[0] ?? null;
}

// GET: List all agency accounts (account_type = 'agency' only)
export async function GET(req: NextRequest) {
  const admin = await verifySuperAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('account_type', 'agency')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companyIds = companies.map((c: { id: string }) => c.id);

  const [proposalCounts, memberCounts, recentActivity] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('proposals').select('company_id').in('company_id', companyIds)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? supabaseAdmin.from('team_members').select('company_id').in('company_id', companyIds)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? supabaseAdmin
          .from('proposals')
          .select('company_id, updated_at')
          .in('company_id', companyIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const stats: Record<string, { proposals: number; members: number; lastActivity: string | null }> = {};
  for (const id of companyIds) {
    stats[id] = { proposals: 0, members: 0, lastActivity: null };
  }

  for (const row of (proposalCounts.data ?? [])) {
    if (stats[row.company_id]) stats[row.company_id].proposals++;
  }
  for (const row of (memberCounts.data ?? [])) {
    if (stats[row.company_id]) stats[row.company_id].members++;
  }

  const seen = new Set<string>();
  for (const row of (recentActivity.data ?? [])) {
    if (!seen.has(row.company_id)) {
      if (stats[row.company_id]) stats[row.company_id].lastActivity = row.updated_at;
      seen.add(row.company_id);
    }
  }

  const result = companies.map((c: Record<string, unknown>) => ({
    ...c,
    stats: stats[c.id as string] ?? { proposals: 0, members: 0, lastActivity: null },
  }));

  return NextResponse.json(result);
}

// POST: Create a new agency account
export async function POST(req: NextRequest) {
  const admin = await verifySuperAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .insert({ name, slug, account_type: 'agency' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This slug is already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(company);
}