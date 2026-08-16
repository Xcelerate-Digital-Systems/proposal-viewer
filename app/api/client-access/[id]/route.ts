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

const REQUEST_COLUMNS = 'id, company_id, client_id, share_token, platforms, status, expires_at, created_by, client_name, client_email, notes, created_at, updated_at';
const GRANT_COLUMNS = 'id, request_id, platform, status, platform_user_id, platform_user_name, platform_account_id, platform_account_name, partner_request_id, error_message, granted_at, created_at, updated_at';

/* ------------------------------------------------------------------ */
/*  GET /api/client-access/[id]                                        */
/*  Get a single access request with its grants                        */
/* ------------------------------------------------------------------ */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'client-access');
  if (limited) return limited;

  const supabase = createServiceClient();

  const { data: request, error } = await supabase
    .from('client_access_requests')
    .select(REQUEST_COLUMNS)
    .eq('id', id)
    .eq('company_id', verified.agencyId)
    .single();

  if (error || !request) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: grants } = await supabase
    .from('client_access_grants')
    .select(GRANT_COLUMNS)
    .eq('request_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ ...request, grants: grants ?? [] });
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/client-access/[id]                                      */
/*  Update an access request (notes, expiry, status)                   */
/* ------------------------------------------------------------------ */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'client-access');
  if (limited) return limited;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from('client_access_requests')
    .select('id, status')
    .eq('id', id)
    .eq('company_id', verified.agencyId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const allowedFields: Record<string, unknown> = {};
  if ('notes' in body) allowedFields.notes = body.notes?.trim() || null;
  if ('client_name' in body) allowedFields.client_name = body.client_name?.trim() || null;
  if ('client_email' in body) allowedFields.client_email = body.client_email?.trim() || null;
  if ('expires_at' in body) allowedFields.expires_at = body.expires_at || null;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  allowedFields.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('client_access_requests')
    .update(allowedFields)
    .eq('id', id)
    .eq('company_id', verified.agencyId)
    .select(REQUEST_COLUMNS)
    .single();

  if (error) {
    console.error('[api/client-access] PATCH:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(updated);
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/client-access/[id]                                     */
/*  Revoke an access request                                           */
/* ------------------------------------------------------------------ */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const verified = await verifyAgencyAdmin(req);
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(verified.agencyId, 'client-access');
  if (limited) return limited;

  const supabase = createServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from('client_access_requests')
    .select('id, status')
    .eq('id', id)
    .eq('company_id', verified.agencyId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.status === 'revoked') {
    return NextResponse.json({ error: 'Already revoked' }, { status: 400 });
  }

  const { error } = await supabase
    .from('client_access_requests')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', verified.agencyId);

  if (error) {
    console.error('[api/client-access] DELETE:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
