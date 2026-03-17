// app/api/ads/creatives/[id]/variants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/* ─── GET — list variants for a creative ──────────────────────────────────── */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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

    const { data, error } = await supabase
      .from('ad_copy_variants')
      .select('*')
      .eq('ad_creative_id', params.id)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Ad copy variants GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — add a variant ────────────────────────────────────────────────── */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { variant_type, label, content } = body;

    if (!variant_type || !label || !content) {
      return NextResponse.json({ error: 'variant_type, label, and content are required' }, { status: 400 });
    }

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

    // Get next sort order
    const { count } = await supabase
      .from('ad_copy_variants')
      .select('*', { count: 'exact', head: true })
      .eq('ad_creative_id', params.id);

    const { data, error } = await supabase
      .from('ad_copy_variants')
      .insert({
        ad_creative_id: params.id,
        variant_type,
        label: label.trim(),
        content: content.trim(),
        sort_order: count || 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Ad copy variants POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
