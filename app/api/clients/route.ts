// app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

// Use the shared no-store-fetch service client. The bare createClient()
// allows Next.js's Data Cache to cache PostgREST GETs, which has previously
// caused stale-auth bugs in this codebase.
const supabaseAdmin = createServiceClient();

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

  const limited = await authRateLimit(verified.agencyId, 'clients');
  if (limited) return limited;

  const { agencyId } = verified;

  const { data: clients, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('account_type', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/clients] GET:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

  const limited = await authRateLimit(verified.agencyId, 'clients');
  if (limited) return limited;

  const { agencyId } = verified;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, slug } = body as { name?: string; slug?: string };

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
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
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This slug is already taken' }, { status: 409 });
    }
    console.error('[api/clients] POST:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(client, { status: 201 });
}