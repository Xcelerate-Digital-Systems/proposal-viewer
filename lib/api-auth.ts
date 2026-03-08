// lib/api-auth.ts
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

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