// lib/api-auth.ts
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

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
 * Supports two company override modes via ?company_id= query parameter:
 *  1. Super admin override — can enter any company unconditionally.
 *  2. Agency override — owners/admins of an agency account can enter any
 *     client company that has agency_id = their own company_id.
 *
 * Returns { member, companyId, accountType } where companyId and accountType
 * reflect the currently active company (may differ from member.company_id
 * when an override is active).
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
  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!member) return null;

  // Check for company override via query param
  const requestedCompanyId = req.nextUrl.searchParams.get('company_id');

  if (requestedCompanyId && requestedCompanyId !== member.company_id) {
    // Super admins can enter any company unconditionally
    if (member.is_super_admin) {
      const { data: targetCompany } = await supabase
        .from('companies')
        .select('account_type')
        .eq('id', requestedCompanyId)
        .single();

      return {
        member,
        companyId: requestedCompanyId,
        accountType: (targetCompany?.account_type ?? 'agency') as 'agency' | 'client',
      };
    }

    // Agency owners/admins can enter their own client companies
    const isAgencyAdmin = member.role === 'owner' || member.role === 'admin';
    if (isAgencyAdmin) {
      const { data: targetCompany } = await supabase
        .from('companies')
        .select('account_type, agency_id')
        .eq('id', requestedCompanyId)
        .single();

      if (
        targetCompany?.account_type === 'client' &&
        targetCompany?.agency_id === member.company_id
      ) {
        return {
          member,
          companyId: requestedCompanyId,
          accountType: 'client' as const,
        };
      }
    }

    // All other cross-company attempts are unauthorized
    return null;
  }

  // No override — resolve own company's account_type
  const { data: ownCompany } = await supabase
    .from('companies')
    .select('account_type')
    .eq('id', member.company_id)
    .single();

  return {
    member,
    companyId: member.company_id as string,
    accountType: (ownCompany?.account_type ?? 'agency') as 'agency' | 'client',
  };
}