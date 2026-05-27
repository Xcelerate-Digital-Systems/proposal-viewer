// app/api/ads/swipe/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { STANDARD_SWIPE_TAGS } from '@/lib/swipe-files/standard-tags';
import { visibleTypesOrFilter } from '@/lib/swipe-files/access';

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

    // Pull tags from every file in every folder visible to the caller — own
    // folders plus those shared with them — so the tag picker includes tags
    // used in shared folders too.
    const { data: visibleTypes } = await supabase
      .from('swipe_types')
      .select('id')
      .or(visibleTypesOrFilter(auth.companyId));

    const visibleIds = (visibleTypes || []).map((t: { id: string }) => t.id);
    let data: { tags: string[] | null }[] | null = [];
    let error: { message: string } | null = null;
    if (visibleIds.length > 0) {
      const res = await supabase.from('swipe_files').select('tags').in('type_id', visibleIds);
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('[api/ads/swipe/tags] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const dynamicSet = new Set<string>();
    (data || []).forEach((row: { tags: string[] | null }) => {
      (row.tags || []).forEach((t) => { if (t) dynamicSet.add(t); });
    });

    // Standard categories always come first in their defined order; any
    // company-specific tags follow in alphabetical order, deduped against
    // the standard set so they don't appear twice.
    STANDARD_SWIPE_TAGS.forEach((t) => dynamicSet.delete(t));
    const merged = [...STANDARD_SWIPE_TAGS, ...Array.from(dynamicSet).sort()];

    return NextResponse.json({ success: true, data: merged });
  } catch (err) {
    console.error('Swipe tags GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
