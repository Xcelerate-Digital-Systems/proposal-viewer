import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await props.params;
  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const { data: views, error } = await supabase
    .from('proposal_views')
    .select('id, viewer_email, viewer_name, device_type, pages_viewed, total_time_seconds, page_times, max_scroll_depth, created_at, last_activity_at')
    .eq('proposal_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[analytics] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const totalViews = views?.length ?? 0;
  const uniqueViewers = new Set((views ?? []).map((v) => v.viewer_email || v.id)).size;
  const avgTimeSeconds = totalViews > 0
    ? Math.round((views ?? []).reduce((sum, v) => sum + (v.total_time_seconds || 0), 0) / totalViews)
    : 0;
  const avgPagesViewed = totalViews > 0
    ? Math.round((views ?? []).reduce((sum, v) => sum + (v.pages_viewed || 0), 0) / totalViews * 10) / 10
    : 0;

  return NextResponse.json({
    summary: { totalViews, uniqueViewers, avgTimeSeconds, avgPagesViewed },
    views: views ?? [],
  });
}
