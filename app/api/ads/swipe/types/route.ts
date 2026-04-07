// app/api/ads/swipe/types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { corsPreflight, withCors } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * Standard ad-type folders seeded on first visit. Order matters — it's how
 * they'll appear in the sidebar. Users can rename, reorder, or delete any of them.
 */
const STANDARD_AD_TYPES = [
  'Image + Headline Overlay',
  'Before and After',
  'Testimonial Overlay',
  'Grid / Collage',
  'Big Question',
  'Reasons Why (Listicle)',
  'Native UI',
  'Meme',
  'Process / Steps',
  'Feature / Benefit Callouts',
  'Us vs. Them',
  'Hand-Written (Ugly Ads)',
  'Copy-Heavy (Text Only)',
  'Educational',
  'Social Screenshot Overlay',
  'Media / News (PR Callout)',
  'UGC AI Video',
  'Founder Video',
];

/* ─── GET — list type folders with file counts ──────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    let { data: types, error } = await supabase
      .from('swipe_types')
      .select('*')
      .eq('company_id', auth.companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // First-time seed: if the company has no ad types yet, insert the standard set.
    if (!types || types.length === 0) {
      const rows = STANDARD_AD_TYPES.map((name, idx) => ({
        company_id: auth.companyId,
        name,
        sort_order: idx,
        is_standard: true,
      }));
      const { data: seeded, error: seedErr } = await supabase
        .from('swipe_types')
        .insert(rows)
        .select();
      if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });
      types = seeded || [];
    }

    const { data: files } = await supabase
      .from('swipe_files')
      .select('type_id')
      .eq('company_id', auth.companyId);

    const counts = new Map<string, number>();
    (files || []).forEach((f: { type_id: string }) => {
      counts.set(f.type_id, (counts.get(f.type_id) || 0) + 1);
    });

    const decorated = (types || []).map((t) => ({ ...t, file_count: counts.get(t.id) || 0 }));

    return NextResponse.json({ success: true, data: decorated });
  } catch (err) {
    console.error('Swipe types GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — create type folder ─────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, description } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('swipe_types')
      .select('sort_order')
      .eq('company_id', auth.companyId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextSort = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

    const { data, error } = await supabase
      .from('swipe_types')
      .insert({
        company_id: auth.companyId,
        name: name.trim(),
        description: description?.trim() || null,
        sort_order: nextSort,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Swipe types POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
