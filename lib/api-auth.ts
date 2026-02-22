// lib/api-auth.ts
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

/**
 * Get the authenticated team member and resolve the effective company_id.
 * Supports super admin override via ?company_id= query parameter.
 * Returns { member, companyId } where companyId may differ from member.company_id
 * if the user is a super admin viewing another company.
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

  // Check for super admin company override
  const requestedCompanyId = req.nextUrl.searchParams.get('company_id');

  if (requestedCompanyId && requestedCompanyId !== member.company_id) {
    // Only super admins can view other companies
    if (!member.is_super_admin) {
      return null; // Unauthorized
    }
    return { member, companyId: requestedCompanyId };
  }

  return { member, companyId: member.company_id as string };
}