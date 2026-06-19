import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';

/** GET /api/campaigns/[id]/ad-variations
 *  List all ad copy variations in this campaign, including which items use each. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/ad-variations');
    if (limited) return limited;


  const { id: projectId } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id')
    .eq('id', projectId)
    .eq('company_id', auth.companyId)
    .single();

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: variations, error } = await supabase
    .from('ad_copy_variations')
    .select('*')
    .eq('review_project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('ad-variations fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to load ad variations' }, { status: 500 });
  }

  // Fetch junction links so the caller knows which items use which variations
  const variationIds = (variations || []).map((v) => v.id);
  let links: { review_item_id: string; ad_copy_variation_id: string; sort_order: number }[] = [];
  if (variationIds.length > 0) {
    const { data } = await supabase
      .from('review_item_ad_variations')
      .select('review_item_id, ad_copy_variation_id, sort_order')
      .in('ad_copy_variation_id', variationIds);
    links = data || [];
  }

  return NextResponse.json({ variations: variations || [], links });
}

/** POST /api/campaigns/[id]/ad-variations
 *  Create one or more variations and optionally link them to a review item.
 *
 *  Body: {
 *    variations: { label?, headline, primary_text }[],
 *    link_to_item_id?: string,   // auto-link new variations to this item
 *    start_sort_order?: number,  // sort_order offset for junction links
 *  }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/ad-variations');
    if (limited) return limited;


  const { id: projectId } = await params;
  const body = await req.json();
  const { variations, link_to_item_id, start_sort_order = 0 } = body as {
    variations: { label?: string | null; headline: string; primary_text: string }[];
    link_to_item_id?: string;
    start_sort_order?: number;
  };

  if (!Array.isArray(variations) || variations.length === 0) {
    return NextResponse.json({ error: 'variations array required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id')
    .eq('id', projectId)
    .eq('company_id', auth.companyId)
    .single();

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = variations.map((v) => ({
    review_project_id: projectId,
    company_id: auth.companyId,
    label: v.label?.trim() || null,
    headline: (v.headline || '').trim(),
    primary_text: (v.primary_text || '').trim(),
    created_by: auth.member.user_id,
  }));

  const { data: created, error } = await supabase
    .from('ad_copy_variations')
    .insert(rows)
    .select();

  if (error || !created) {
    console.error('ad-variations insert error:', error?.message);
    return NextResponse.json({ error: 'Failed to create ad variations' }, { status: 500 });
  }

  // Auto-link to item if requested
  if (link_to_item_id && created.length > 0) {
    const junctionRows = created.map((v, i) => ({
      review_item_id: link_to_item_id,
      ad_copy_variation_id: v.id,
      sort_order: start_sort_order + i,
    }));
    await supabase.from('review_item_ad_variations').insert(junctionRows);
  }

  return NextResponse.json({ variations: created }, { status: 201 });
}

/** PATCH /api/campaigns/[id]/ad-variations
 *  Update a variation's copy. Changes propagate to all items that use it.
 *
 *  Body: { variation_id: string, label?, headline?, primary_text? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/ad-variations');
    if (limited) return limited;


  const { id: projectId } = await params;
  const body = await req.json();
  const { variation_id, ...patch } = body as {
    variation_id: string;
    label?: string | null;
    headline?: string;
    primary_text?: string;
  };

  if (!variation_id) {
    return NextResponse.json({ error: 'variation_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) update.label = patch.label?.trim() || null;
  if (patch.headline !== undefined) update.headline = patch.headline.trim();
  if (patch.primary_text !== undefined) update.primary_text = patch.primary_text.trim();

  const { data, error } = await supabase
    .from('ad_copy_variations')
    .update(update)
    .eq('id', variation_id)
    .eq('review_project_id', projectId)
    .eq('company_id', auth.companyId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
