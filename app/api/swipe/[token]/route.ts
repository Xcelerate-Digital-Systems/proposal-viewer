// app/api/swipe/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';

/**
 * GET /api/swipe/[token]
 *
 * Resolves a swipe-file share token. Every swipe is publicly shareable via its
 * token — there is no separate "make public" toggle. The public viewer renders
 * the same detail layout as the admin-side popup.
 */
const SWIPE_PUBLIC_COLUMNS = 'id, title, notes, media_url, media_type, thumbnail_url, type_id, platform, brand_name, share_token, transcription, tags, landing_page_url, created_at';

export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const rl = await rateLimit({ key: `pub-swipe:${ipFromRequest(_req)}`, limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 60) });
    }

    const supabase = createServiceClient();

    const { data: file } = await supabase
      .from('swipe_files')
      .select(SWIPE_PUBLIC_COLUMNS)
      .eq('share_token', params.token)
      .maybeSingle();

    if (!file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: type } = await supabase
      .from('swipe_types')
      .select('id, name')
      .eq('id', file.type_id)
      .maybeSingle();

    return NextResponse.json({ mode: 'file', file, type: type || null });
  } catch (err) {
    console.error('Swipe token resolver error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
