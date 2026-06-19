import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/funnel/[token]
 *
 * Public route — loads a funnel, its steps, edges, notes, and shapes for the
 * read-only viewer. Token is `funnels.share_token`.
 *
 * Uses get_funnel_data RPC (mirrors get_whiteboard_data) so we fetch
 * everything in one round trip.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `pub-funnel:${ipFromRequest(_req)}`, limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 60) });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('get_funnel_data', { p_token: params.token });

    if (error) {
      console.error('Funnel RPC error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    if (!data || data.error === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const res = NextResponse.json({
      funnel: data.funnel,
      steps: data.steps || [],
      boardEdges: data.boardEdges || [],
      boardNotes: data.boardNotes || [],
      boardShapes: data.boardShapes || [],
    });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (err) {
    console.error('Funnel fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
