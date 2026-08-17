import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';
import { VALID_PLATFORMS, type AccessPlatform } from '@/lib/client-access/types';

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

/* ------------------------------------------------------------------ */
/*  GET /api/client-access                                             */
/*  List all access requests for the agency                            */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'client-access');
  if (limited) return limited;

  const supabase = createServiceClient();

  const clientId = req.nextUrl.searchParams.get('client_id');

  let query = supabase
    .from('client_access_requests')
    .select('id, company_id, client_id, share_token, platforms, platform_config, status, expires_at, created_by, client_name, client_email, notes, created_at, updated_at')
    .eq('company_id', verified.agencyId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[api/client-access] GET:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Fetch grants for all returned requests
  const requestIds = (data ?? []).map((r: { id: string }) => r.id);
  let grants: Record<string, unknown>[] = [];

  if (requestIds.length > 0) {
    const { data: grantRows } = await supabase
      .from('client_access_grants')
      .select('id, request_id, platform, status, platform_account_name, granted_at, error_message')
      .in('request_id', requestIds);
    grants = grantRows ?? [];
  }

  const grantsByRequest = new Map<string, typeof grants>();
  for (const g of grants) {
    const rid = g.request_id as string;
    if (!grantsByRequest.has(rid)) grantsByRequest.set(rid, []);
    grantsByRequest.get(rid)!.push(g);
  }

  const result = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    grants: grantsByRequest.get(r.id as string) ?? [],
  }));

  return NextResponse.json(result);
}

/* ------------------------------------------------------------------ */
/*  POST /api/client-access                                            */
/*  Create a new access request                                        */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'client-access');
  if (limited) return limited;

  // Entitlement check
  const check = await checkResourceLimit(verified.agencyId, 'client_access_requests');
  if (!check.allowed) {
    return NextResponse.json(buildLimitErrorBody(check, 'client_access_requests'), { status: 402 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    client_id,
    platforms,
    client_name,
    client_email,
    notes,
    expires_in_days,
    platform_config,
  } = body as {
    client_id?: string;
    platforms?: string[];
    client_name?: string;
    client_email?: string;
    notes?: string;
    expires_in_days?: number;
    platform_config?: Record<string, unknown>;
  };

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: 'At least one platform is required' }, { status: 400 });
  }

  const invalidPlatforms = platforms.filter((p) => !VALID_PLATFORMS.includes(p as AccessPlatform));
  if (invalidPlatforms.length > 0) {
    return NextResponse.json(
      { error: `Invalid platforms: ${invalidPlatforms.join(', ')}` },
      { status: 400 },
    );
  }

  if (!client_name?.trim() && !client_email?.trim() && !client_id) {
    return NextResponse.json(
      { error: 'Provide client_name, client_email, or client_id' },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // If client_id provided, verify it belongs to this agency
  if (client_id) {
    const { data: clientCompany } = await supabase
      .from('companies')
      .select('id, agency_id, account_type')
      .eq('id', client_id)
      .single();

    if (
      !clientCompany ||
      clientCompany.account_type !== 'client' ||
      clientCompany.agency_id !== verified.agencyId
    ) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
  }

  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: request, error } = await supabase
    .from('client_access_requests')
    .insert({
      company_id: verified.agencyId,
      client_id: client_id || null,
      platforms: platforms as AccessPlatform[],
      status: 'pending',
      expires_at: expiresAt,
      created_by: (verified.member as Record<string, unknown>).user_id as string,
      client_name: client_name?.trim() || null,
      client_email: client_email?.trim() || null,
      notes: notes?.trim() || null,
      platform_config: platform_config || null,
    })
    .select('id, company_id, client_id, share_token, platforms, status, expires_at, created_by, client_name, client_email, notes, created_at, updated_at')
    .single();

  if (error) {
    console.error('[api/client-access] POST:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Create grant rows for each platform
  const grantInserts = (platforms as AccessPlatform[]).map((platform) => ({
    request_id: request.id,
    platform,
    status: 'pending',
  }));

  const { data: grants, error: grantError } = await supabase
    .from('client_access_grants')
    .insert(grantInserts)
    .select('id, request_id, platform, status');

  if (grantError) {
    console.error('[api/client-access] POST grants:', grantError.message);
  }

  return NextResponse.json(
    { ...request, grants: grants ?? [] },
    { status: 201 },
  );
}
