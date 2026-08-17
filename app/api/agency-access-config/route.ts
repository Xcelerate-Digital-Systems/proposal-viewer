import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

async function verifyAgencyAdmin(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return null;

  const { member, companyId } = auth;

  if (member.is_super_admin) {
    return { member, agencyId: companyId };
  }

  if (member.role !== 'owner' && member.role !== 'admin') return null;

  const supabase = createServiceClient();
  const { data: ownCompany } = await supabase
    .from('companies')
    .select('account_type')
    .eq('id', member.company_id)
    .single();

  if (ownCompany?.account_type !== 'agency') return null;

  return { member, agencyId: member.company_id as string };
}

const CONFIG_COLUMNS = 'id, company_id, universal_share_token, default_platforms, platform_config, meta_business_id, meta_business_name, meta_user_id, meta_user_name, google_mcc_id, google_mcc_name, google_analytics_email, google_gtm_email, google_gbp_email, google_search_console_email, google_merchant_center_email, google_user_name, wordpress_admin_email, created_at, updated_at';

/* ------------------------------------------------------------------ */
/*  GET /api/agency-access-config                                      */
/*  Get the agency's platform configuration                            */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'agency-access-config');
  if (limited) return limited;

  const supabase = createServiceClient();

  const { data } = await supabase
    .from('agency_access_config')
    .select(CONFIG_COLUMNS)
    .eq('company_id', verified.agencyId)
    .maybeSingle();

  return NextResponse.json(data || { company_id: verified.agencyId });
}

/* ------------------------------------------------------------------ */
/*  PUT /api/agency-access-config                                      */
/*  Upsert the agency's platform configuration                        */
/* ------------------------------------------------------------------ */
export async function PUT(req: NextRequest) {
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'agency-access-config');
  if (limited) return limited;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowedFields: Record<string, unknown> = {
    company_id: verified.agencyId,
    updated_at: new Date().toISOString(),
  };

  if ('meta_business_id' in body) allowedFields.meta_business_id = body.meta_business_id?.trim() || null;
  if ('meta_business_name' in body) allowedFields.meta_business_name = body.meta_business_name?.trim() || null;
  if ('google_mcc_id' in body) allowedFields.google_mcc_id = body.google_mcc_id?.trim() || null;
  if ('google_mcc_name' in body) allowedFields.google_mcc_name = body.google_mcc_name?.trim() || null;
  if ('google_analytics_email' in body) allowedFields.google_analytics_email = body.google_analytics_email?.trim() || null;
  if ('google_gtm_email' in body) allowedFields.google_gtm_email = body.google_gtm_email?.trim() || null;
  if ('google_gbp_email' in body) allowedFields.google_gbp_email = body.google_gbp_email?.trim() || null;
  if ('google_search_console_email' in body) allowedFields.google_search_console_email = body.google_search_console_email?.trim() || null;
  if ('google_merchant_center_email' in body) allowedFields.google_merchant_center_email = body.google_merchant_center_email?.trim() || null;
  if ('wordpress_admin_email' in body) allowedFields.wordpress_admin_email = body.wordpress_admin_email?.trim() || null;
  if ('default_platforms' in body && Array.isArray(body.default_platforms)) {
    allowedFields.default_platforms = body.default_platforms;
  }
  if ('platform_config' in body && typeof body.platform_config === 'object') {
    allowedFields.platform_config = body.platform_config;
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('agency_access_config')
    .upsert(allowedFields, { onConflict: 'company_id' })
    .select(CONFIG_COLUMNS)
    .single();

  if (error) {
    console.error('[api/agency-access-config] PUT:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(data);
}
