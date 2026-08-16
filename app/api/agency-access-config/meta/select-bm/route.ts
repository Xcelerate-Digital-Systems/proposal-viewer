import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export async function PUT(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { member, companyId } = auth;
  if (member.role !== 'owner' && member.role !== 'admin' && !member.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limited = await authRateLimit(companyId, 'agency-access-config');
  if (limited) return limited;

  let body: { meta_business_id: string; meta_business_name: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.meta_business_id || !body.meta_business_name) {
    return NextResponse.json({ error: 'meta_business_id and meta_business_name required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('agency_access_config')
    .update({
      meta_business_id: body.meta_business_id.trim(),
      meta_business_name: body.meta_business_name.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .select('meta_business_id, meta_business_name')
    .single();

  if (error) {
    console.error('[agency-access-config/meta/select-bm] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json(data);
}
