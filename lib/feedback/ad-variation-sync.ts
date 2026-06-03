import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetaAdVariant } from '@/lib/types/feedback';

/**
 * Sync the denormalized `meta_ad_variants` JSONB column on a review_item
 * from the junction table + ad_copy_variations rows.
 *
 * This keeps the existing view layer working without changes — all mockup
 * rendering, variant pill switching, and pin-scoping reads from the inline
 * JSONB. The junction table is the source of truth; the JSONB is a cache.
 */
export async function syncItemVariantsJsonb(
  supabase: SupabaseClient,
  reviewItemId: string,
): Promise<void> {
  // Fetch linked variations in sort order
  const { data: links } = await supabase
    .from('review_item_ad_variations')
    .select('ad_copy_variation_id, sort_order')
    .eq('review_item_id', reviewItemId)
    .order('sort_order', { ascending: true });

  if (!links || links.length === 0) {
    // No variations linked — clear the JSONB
    await supabase
      .from('review_items')
      .update({
        meta_ad_variants: null,
        ad_headline: null,
        ad_copy: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewItemId);
    return;
  }

  const variationIds = links.map((l) => l.ad_copy_variation_id);
  const { data: variations } = await supabase
    .from('ad_copy_variations')
    .select('id, label, headline, primary_text')
    .in('id', variationIds);

  if (!variations) return;

  // Order by junction sort_order
  const byId = new Map(variations.map((v) => [v.id, v]));
  const ordered = variationIds
    .map((id) => byId.get(id))
    .filter(Boolean) as typeof variations;

  const metaAdVariants: MetaAdVariant[] = ordered.map((v) => ({
    id: v.id,
    label: v.label || null,
    headline: v.headline,
    primary_text: v.primary_text,
  }));

  const first = metaAdVariants[0];

  await supabase
    .from('review_items')
    .update({
      meta_ad_variants: metaAdVariants,
      ad_headline: first?.headline || null,
      ad_copy: first?.primary_text || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewItemId);
}

/**
 * Batch-create variations from inline MetaAdVariant data, link them to an
 * item, and sync the JSONB. Used by the create/submit flow when the user
 * creates new variations inline in the modal.
 */
export async function createAndLinkVariations(
  supabase: SupabaseClient,
  opts: {
    reviewProjectId: string;
    companyId: string;
    reviewItemId: string;
    createdBy: string | null;
    newVariations: { label?: string | null; headline: string; primary_text: string }[];
    existingVariationIds: string[];
    startSortOrder?: number;
  },
): Promise<string[]> {
  const {
    reviewProjectId, companyId, reviewItemId, createdBy,
    newVariations, existingVariationIds, startSortOrder = 0,
  } = opts;

  let allVariationIds = [...existingVariationIds];

  // Create new variation rows
  if (newVariations.length > 0) {
    const rows = newVariations.map((v) => ({
      review_project_id: reviewProjectId,
      company_id: companyId,
      label: v.label?.trim() || null,
      headline: (v.headline || '').trim(),
      primary_text: (v.primary_text || '').trim(),
      created_by: createdBy,
    }));

    const { data: created } = await supabase
      .from('ad_copy_variations')
      .insert(rows)
      .select('id');

    if (created) {
      allVariationIds = [...allVariationIds, ...created.map((c) => c.id)];
    }
  }

  // Set junction links (replace all for this item)
  await supabase
    .from('review_item_ad_variations')
    .delete()
    .eq('review_item_id', reviewItemId);

  if (allVariationIds.length > 0) {
    const junctionRows = allVariationIds.map((vid, i) => ({
      review_item_id: reviewItemId,
      ad_copy_variation_id: vid,
      sort_order: startSortOrder + i,
    }));
    await supabase
      .from('review_item_ad_variations')
      .insert(junctionRows);
  }

  // Sync the denormalized JSONB
  await syncItemVariantsJsonb(supabase, reviewItemId);

  return allVariationIds;
}
