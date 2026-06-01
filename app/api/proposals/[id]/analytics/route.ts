import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    const supabase = createServiceClient();

    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, client_name, client_email')
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const { data: views, error } = await supabase
      .from('proposal_views')
      .select('id, viewer_ip, viewer_email, viewer_name, device_type, pages_viewed, total_time_seconds, page_times, max_scroll_depth, created_at, last_activity_at')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[analytics] GET error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const rows = views ?? [];
    const totalSessions = rows.length;

    const uniqueIps = new Set(rows.map((v) => v.viewer_ip).filter(Boolean));
    const uniqueViewers = Math.max(uniqueIps.size, totalSessions > 0 ? 1 : 0);

    const totalTimeAll = rows.reduce((sum, v) => sum + (v.total_time_seconds || 0), 0);
    const avgTimeSeconds = totalSessions > 0 ? Math.round(totalTimeAll / totalSessions) : 0;
    const totalPagesAll = rows.reduce((sum, v) => sum + (v.pages_viewed || 0), 0);
    const avgPagesViewed = totalSessions > 0
      ? Math.round((totalPagesAll / totalSessions) * 10) / 10
      : 0;

    const firstViewedAt = totalSessions > 0 ? rows[rows.length - 1].created_at : null;
    const lastViewedAt = totalSessions > 0 ? rows[0].created_at : null;

    const pageTimeAgg: Record<string, number> = {};
    for (const v of rows) {
      if (v.page_times && typeof v.page_times === 'object') {
        for (const [pageIdx, secs] of Object.entries(v.page_times as Record<string, number>)) {
          pageTimeAgg[pageIdx] = (pageTimeAgg[pageIdx] || 0) + (typeof secs === 'number' ? secs : 0);
        }
      }
    }

    const { data: pages } = await supabase
      .from('proposal_pages_v2')
      .select('position, title, type')
      .eq('proposal_id', id)
      .order('position', { ascending: true });

    const pageBreakdown = Object.entries(pageTimeAgg)
      .map(([idx, totalSecs]) => {
        const pos = parseInt(idx, 10);
        const page = (pages ?? []).find((p) => p.position === pos);
        return {
          pageIndex: pos,
          pageName: page?.title || `Page ${pos + 1}`,
          pageType: page?.type || 'pdf',
          totalSeconds: Math.round(totalSecs),
          sessions: rows.filter(
            (v) => v.page_times && typeof v.page_times === 'object' && (idx in (v.page_times as Record<string, number>)),
          ).length,
        };
      })
      .sort((a, b) => a.pageIndex - b.pageIndex);

    const sessions = rows.map((v) => {
      const name = v.viewer_name || proposal.client_name || null;
      const email = v.viewer_email || proposal.client_email || null;
      return {
        id: v.id,
        viewerName: name,
        viewerEmail: email,
        deviceType: v.device_type || 'desktop',
        pagesViewed: v.pages_viewed || 1,
        totalTimeSeconds: v.total_time_seconds || 0,
        maxScrollDepth: v.max_scroll_depth || 0,
        pageTimes: v.page_times || {},
        startedAt: v.created_at,
        lastActivityAt: v.last_activity_at,
      };
    });

    return NextResponse.json({
      summary: {
        totalSessions,
        uniqueViewers,
        avgTimeSeconds,
        avgPagesViewed,
        totalTimeSeconds: totalTimeAll,
        firstViewedAt,
        lastViewedAt,
      },
      pageBreakdown,
      sessions,
    });
  } catch (err) {
    console.error('[api/proposals/[id]/analytics] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
