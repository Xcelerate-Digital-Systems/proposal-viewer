// app/api/ads/swipe/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ads/swipe/tags
 *
 * Returns the distinct set of angle tags used across all swipe files for the
 * company, sorted alphabetically. Used to populate the tag dropdown when
 * creating/editing a swipe.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('swipe_files')
      .select('tags')
      .eq('company_id', auth.companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const set = new Set<string>();
    (data || []).forEach((row: { tags: string[] | null }) => {
      (row.tags || []).forEach((t) => { if (t) set.add(t); });
    });

    return NextResponse.json({ success: true, data: Array.from(set).sort() });
  } catch (err) {
    console.error('Swipe tags GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
