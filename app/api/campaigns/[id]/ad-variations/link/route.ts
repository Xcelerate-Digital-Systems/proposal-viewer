import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { syncItemVariantsJsonb } from '@/lib/feedback/ad-variation-sync';

/** POST /api/campaigns/[id]/ad-variations/link
 *  Set which variations are linked to a review item. Replaces all existing
 *  links for that item with the new set, then syncs the denormalized
 *  meta_ad_variants JSONB so the view layer stays in sync.
 *
 *  Body: {
 *    review_item_id: string,
 *    variation_ids: string[],   // ordered — sort_order = array index
 *  }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const body = await req.json();
  const { review_item_id, variation_ids } = body as {
    review_item_id: string;
    variation_ids: string[];
  };

  if (!review_item_id || !Array.isArray(variation_ids)) {
    return NextResponse.json({ error: 'review_item_id and variation_ids required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify item belongs to this project + company
  const { data: item } = await supabase
    .from('review_items')
    .select('id, review_project_id')
    .eq('id', review_item_id)
    .eq('review_project_id', projectId)
    .single();

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Delete existing links for this item
  await supabase
    .from('review_item_ad_variations')
    .delete()
    .eq('review_item_id', review_item_id);

  // Insert new links
  if (variation_ids.length > 0) {
    const rows = variation_ids.map((vid, i) => ({
      review_item_id,
      ad_copy_variation_id: vid,
      sort_order: i,
    }));
    const { error } = await supabase
      .from('review_item_ad_variations')
      .insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync the denormalized meta_ad_variants JSONB on the item
  await syncItemVariantsJsonb(supabase, review_item_id);

  return NextResponse.json({ success: true });
}
