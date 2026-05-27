// app/api/admin/join-as-member/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * POST /api/admin/join-as-member
 * Body: { company_id: string, role?: 'owner' | 'admin' | 'member' }
 *
 * Super-admin-only endpoint that creates a team_members row for the caller
 * in the target company (default role: 'admin'). This is how the platform
 * owner adds themselves as a real member of any workspace they need
 * recurring access to — once added, the workspace shows up in the normal
 * workspace switcher and the override mechanism is no longer needed for
 * day-to-day work there.
 *
 * Idempotent: if the caller is already a member, returns the existing row
 * with `already_member: true` so the UI can switch into it instead of
 * erroring.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Caller must be a super admin (their own home team_member row carries the flag).
  const { data: superRows } = await supabase
    .from('team_members')
    .select('id, name, email, is_super_admin')
    .eq('user_id', user.id)
    .eq('is_super_admin', true)
    .limit(1);
  const superAdmin = superRows?.[0];
  if (!superAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const companyId = typeof body.company_id === 'string' ? body.company_id : null;
  const requestedRole = body.role;
  const role: 'owner' | 'admin' | 'member' =
    requestedRole === 'owner' || requestedRole === 'admin' || requestedRole === 'member'
      ? requestedRole
      : 'admin';

  if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

  // Verify the company exists.
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single();
  if (companyErr || !company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // Already a member? Return the existing row so the client can switch.
  const { data: existing } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ membership: existing, already_member: true });
  }

  // Insert. We carry the caller's display name + email forward so the new
  // workspace doesn't surface a blank "?" avatar everywhere.
  const { data: inserted, error: insertErr } = await supabase
    .from('team_members')
    .insert({
      user_id: user.id,
      company_id: companyId,
      name: superAdmin.name || user.email?.split('@')[0] || 'Platform Admin',
      email: superAdmin.email || user.email || null,
      role,
      // Super-admin flag is platform-wide and lives on the user's *home*
      // membership only — joining another workspace doesn't grant super
      // admin on that workspace; the user just becomes a regular member
      // with the requested role.
      is_super_admin: false,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[api/admin/join-as-member] POST insert:', insertErr.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  return NextResponse.json({ membership: inserted, already_member: false });
}
