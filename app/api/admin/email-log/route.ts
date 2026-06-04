// app/api/admin/email-log/route.ts
// Query the email_log table. Accessible to agency admins (own company)
// and super-admins (any company).

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const to = url.searchParams.get('to');
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const entityType = url.searchParams.get('entity_type');
    const entityId = url.searchParams.get('entity_id');

    const companyId = auth.member.is_super_admin
      ? url.searchParams.get('company_id') || auth.companyId
      : auth.companyId;

    const supabase = createServiceClient();

    let query = supabase
      .from('email_log')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (to) query = query.ilike('to_email', `%${to}%`);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, count, error } = await query;

    if (error) {
      console.error('email-log query error:', error);
      return NextResponse.json({ error: 'Failed to query email log' }, { status: 500 });
    }

    return NextResponse.json({ emails: data ?? [], total: count ?? 0 });
  } catch (err) {
    console.error('email-log error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
