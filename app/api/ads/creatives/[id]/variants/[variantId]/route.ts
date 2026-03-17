// app/api/ads/creatives/[id]/variants/[variantId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/* ─── PATCH — update a variant ────────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    // Verify creative belongs to company
    const { data: creative } = await supabase
      .from('ad_creatives')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();

    if (!creative) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.variant_type !== undefined) updates.variant_type = body.variant_type;
    if (body.label !== undefined) updates.label = body.label.trim();
    if (body.content !== undefined) updates.content = body.content.trim();
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('ad_copy_variants')
      .update(updates)
      .eq('id', params.variantId)
      .eq('ad_creative_id', params.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Ad copy variant PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── DELETE — delete a variant ───────────────────────────────────────────── */

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    // Verify creative belongs to company
    const { data: creative } = await supabase
      .from('ad_creatives')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();

    if (!creative) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('ad_copy_variants')
      .delete()
      .eq('id', params.variantId)
      .eq('ad_creative_id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Ad copy variant DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
