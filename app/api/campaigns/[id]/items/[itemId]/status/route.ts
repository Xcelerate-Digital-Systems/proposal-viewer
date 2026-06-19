import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';

const VALID_STATUSES = ['draft', 'internal_review', 'client_review', 'approved', 'revision_needed', 'rejected'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string; itemId: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/items/status');
    if (limited) return limited;

  if (!auth.member.is_super_admin && auth.accountType !== 'agency') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from('review_items')
    .select('id, review_project_id, company_id')
    .eq('id', params.itemId)
    .single();

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();

  if (!project || project.company_id !== auth.companyId || item.review_project_id !== project.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from('review_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', params.itemId)
    .select('id, status')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });

  return NextResponse.json({ success: true, item: updated });
}
