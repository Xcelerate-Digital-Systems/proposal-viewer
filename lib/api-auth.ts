// lib/api-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { canRole, type PermissionKey } from '@/lib/permissions';

/** API key prefix marking it as an Agency Viz personal access token. */
export const API_KEY_PREFIX = 'av_live_';

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Resolve an API-key bearer token to an auth context. Returns null if the
 * key is unknown, revoked, or its company/team-member can't be found.
 */
async function getAuthContextFromApiKey(token: string) {
  const supabase = createServiceClient();
  const keyHash = hashApiKey(token);

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, company_id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .single();

  if (!key || key.revoked_at) return null;

  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', key.user_id)
    .eq('company_id', key.company_id)
    .single();
  if (!member) return null;

  const { data: company } = await supabase
    .from('companies')
    .select('account_type')
    .eq('id', key.company_id)
    .single();

  // Fire-and-forget last_used_at update
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
    .then(() => {});

  return {
    member,
    companyId: key.company_id as string,
    accountType: (company?.account_type ?? 'agency') as 'agency' | 'client',
  };
}

/**
 * Get the authenticated team member and resolve the effective company_id.
 *
 * A user can hold a team_members row in N companies (unique constraint is
 * on (user_id, company_id), not user_id alone). Resolution order for the
 * incoming request:
 *
 *  1. `?membership_id=<id>` — if the id maps to one of the user's rows,
 *     use it. The `member` returned reflects the role *in that workspace*.
 *  2. `?company_id=<id>` — if the id matches a company the user is a real
 *     member of, the matching membership row is used (no override needed).
 *  3. `?company_id=<id>` + super admin — enter any company unconditionally
 *     (read-only "view as" for support / debugging).
 *  4. `?company_id=<id>` + agency owner/admin — enter their own client
 *     companies (agency_id = their company_id).
 *  5. No override — the user's default membership (super-admin row first,
 *     else oldest).
 *
 * Returns { member, companyId, accountType } where companyId and accountType
 * reflect the currently active company.
 */
export async function getAuthContext(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');

  // API key path — bypasses Supabase auth and resolves a fixed company/user.
  // Company override via ?company_id= is intentionally NOT honoured for API
  // keys, since a key is scoped to one company at issue time.
  if (token.startsWith(API_KEY_PREFIX)) {
    return getAuthContextFromApiKey(token);
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .order('is_super_admin', { ascending: false })
    .order('created_at', { ascending: true });

  if (!members || members.length === 0) return null;

  const defaultMember = members[0];
  const requestedMembershipId = req.nextUrl.searchParams.get('membership_id');
  const requestedCompanyId = req.nextUrl.searchParams.get('company_id');

  // (1) explicit membership id — caller has picked a specific workspace they
  // belong to. The role/permissions come from THAT membership, not from the
  // user's default home company. This is how the workspace switcher tells
  // the server which workspace to act inside of.
  if (requestedMembershipId) {
    const picked = members.find((m) => m.id === requestedMembershipId);
    if (picked) {
      const { data: company } = await supabase
        .from('companies')
        .select('account_type')
        .eq('id', picked.company_id)
        .single();
      return {
        member: picked,
        companyId: picked.company_id as string,
        accountType: (company?.account_type ?? 'agency') as 'agency' | 'client',
      };
    }
    // Unknown membership id — fall through; don't 403 because the caller may
    // have stale localStorage from a deleted membership.
  }

  // (2) ?company_id= that matches one of the user's real memberships — use
  // that membership directly (no override gate required).
  if (requestedCompanyId) {
    const matchingMembership = members.find((m) => m.company_id === requestedCompanyId);
    if (matchingMembership) {
      const { data: company } = await supabase
        .from('companies')
        .select('account_type')
        .eq('id', matchingMembership.company_id)
        .single();
      return {
        member: matchingMembership,
        companyId: matchingMembership.company_id as string,
        accountType: (company?.account_type ?? 'agency') as 'agency' | 'client',
      };
    }
  }

  // (3 + 4) ?company_id= override — super admin or agency admin viewing a
  // company they are NOT a real member of. Member object stays as the user's
  // default (so role is preserved for permission checks).
  if (requestedCompanyId && requestedCompanyId !== defaultMember.company_id) {
    if (defaultMember.is_super_admin) {
      const { data: targetCompany } = await supabase
        .from('companies')
        .select('account_type')
        .eq('id', requestedCompanyId)
        .single();
      return {
        member: defaultMember,
        companyId: requestedCompanyId,
        accountType: (targetCompany?.account_type ?? 'agency') as 'agency' | 'client',
      };
    }

    const isAgencyAdmin = defaultMember.role === 'owner' || defaultMember.role === 'admin';
    if (isAgencyAdmin) {
      const { data: targetCompany } = await supabase
        .from('companies')
        .select('account_type, agency_id')
        .eq('id', requestedCompanyId)
        .single();
      if (
        targetCompany?.account_type === 'client' &&
        targetCompany?.agency_id === defaultMember.company_id
      ) {
        return {
          member: defaultMember,
          companyId: requestedCompanyId,
          accountType: 'client' as const,
        };
      }
    }

    return null;
  }

  // (5) default membership
  const { data: ownCompany } = await supabase
    .from('companies')
    .select('account_type')
    .eq('id', defaultMember.company_id)
    .single();

  return {
    member: defaultMember,
    companyId: defaultMember.company_id as string,
    accountType: (ownCompany?.account_type ?? 'agency') as 'agency' | 'client',
  };
}

/**
 * Verify the authenticated user holds a specific permission. Returns the auth
 * context on success, or a 403 NextResponse on failure. Super admins bypass
 * all permission checks.
 *
 * Usage:
 *   const result = await requirePermission(req, 'manage_billing');
 *   if (result instanceof NextResponse) return result;
 *   const { member, companyId } = result;
 */
export async function requirePermission(
  req: NextRequest,
  permission: PermissionKey,
): Promise<
  | NextResponse
  | { member: Record<string, unknown>; companyId: string; accountType: 'agency' | 'client' }
> {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.member.is_super_admin) return auth;
  if (!canRole(auth.member.role as string, permission)) {
    return NextResponse.json(
      { error: `Forbidden: requires ${permission}` },
      { status: 403 },
    );
  }
  return auth;
}