// app/api/ads/swipe/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const typeId = req.nextUrl.searchParams.get('type_id');
    const supabase = createServiceClient();

    let query = supabase
      .from('swipe_files')
      .select('*')
      .eq('company_id', auth.companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (typeId) query = query.eq('type_id', typeId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Swipe files GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      type_id, title, notes, headline, primary_text, description, cta, tags,
      media_type, media_url, media_source, thumbnail_url, source_url, brand,
    } = body;

    if (!type_id) return NextResponse.json({ error: 'type_id required' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: type } = await supabase
      .from('swipe_types')
      .select('id')
      .eq('id', type_id)
      .eq('company_id', auth.companyId)
      .single();
    if (!type) return NextResponse.json({ error: 'Type not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('swipe_files')
      .insert({
        company_id: auth.companyId,
        type_id,
        title: title.trim(),
        notes: notes?.trim() || null,
        headline: headline?.trim() || null,
        primary_text: primary_text?.trim() || null,
        description: description?.trim() || null,
        cta: cta?.trim() || null,
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
        media_type: media_type || null,
        media_url: media_url?.trim() || null,
        media_source: media_source || null,
        thumbnail_url: thumbnail_url?.trim() || null,
        source_url: source_url?.trim() || null,
        brand: brand?.trim() || null,
        created_by: auth.member.user_id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Swipe files POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
