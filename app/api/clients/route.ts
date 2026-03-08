// app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthContext } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verify the caller is an agency owner/admin (or super admin).
 * Returns { member, agencyId } on success, null on failure.
 */
async function verifyAgencyAdmin(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return null;

  const { member, companyId } = auth;

  // Super admins are allowed through; resolve agencyId from query param if present
  if (member.is_super_admin) {
    return { member, agencyId: companyId };
  }

  // Must be owner or admin
  if (member.role !== 'owner' && member.role !== 'admin') return null;

  // Own company must be an agency
  const { data: ownCompany } = await supabaseAdmin
    .from('companies')
    .select('account_type')
    .eq('id', member.company_id)
    .single();

  if (ownCompany?.account_type !== 'agency') return null;

  return { member, agencyId: member.company_id as string };
}

/* ------------------------------------------------------------------ */
/*  GET /api/clients                                                   */
/*  List all client companies belonging to the caller's agency         */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { agencyId } = verified;

  const { data: clients, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('account_type', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach lightweight stats (same pattern as /api/admin/accounts)
  const clientIds = (clients ?? []).map((c: { id: string }) => c.id);

  const [proposalCounts, memberCounts, recentActivity] = await Promise.all([
    clientIds.length
      ? supabaseAdmin.from('proposals').select('company_id').in('company_id', clientIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? supabaseAdmin.from('team_members').select('company_id').in('company_id', clientIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? supabaseAdmin
          .from('proposals')
          .select('company_id, updated_at')
          .in('company_id', clientIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const stats: Record<string, { proposals: number; members: number; lastActivity: string | null }> = {};
  for (const id of clientIds) {
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

  const result = (clients ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    stats: stats[c.id as string] ?? { proposals: 0, members: 0, lastActivity: null },
  }));

  return NextResponse.json(result);
}

/* ------------------------------------------------------------------ */
/*  POST /api/clients                                                  */
/*  Create a new client company under the caller's agency              */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { agencyId } = verified;

  const body = await req.json();
  const { name, slug } = body as { name?: string; slug?: string };

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  // Slug must be unique
  const { data: existing } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('slug', slug.trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
  }

  const { data: client, error } = await supabaseAdmin
    .from('companies')
    .insert({
      name: name.trim(),
      slug: slug.trim(),
      account_type: 'client',
      agency_id: agencyId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(client, { status: 201 });
}