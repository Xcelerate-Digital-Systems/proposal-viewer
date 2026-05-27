// app/api/ads/swipe/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { fetchAccessibleType, visibleTypesOrFilter } from '@/lib/swipe-files/access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const typeId = req.nextUrl.searchParams.get('type_id');
    const supabase = createServiceClient();

    // Single-folder query: authorize via the folder (which may be shared),
    // not via the file's company_id — shared files are owned by the folder's
    // owning company.
    if (typeId) {
      const access = await fetchAccessibleType(supabase, typeId, auth.companyId);
      if (!access) return NextResponse.json({ error: 'Type not found' }, { status: 404 });

      const { data, error } = await supabase
        .from('swipe_files')
        .select('*')
        .eq('type_id', typeId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[api/ads/swipe/files] GET:', error.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    }

    // No type filter: return every file in every folder the caller can see.
    const { data: visibleTypes } = await supabase
      .from('swipe_types')
      .select('id')
      .or(visibleTypesOrFilter(auth.companyId));

    const visibleIds = (visibleTypes || []).map((t: { id: string }) => t.id);
    if (visibleIds.length === 0) return NextResponse.json({ success: true, data: [] });

    const { data, error } = await supabase
      .from('swipe_files')
      .select('*')
      .in('type_id', visibleIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/ads/swipe/files] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
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

    // Callers can create files in any folder they can access — own or shared.
    // The file's company_id is set to the *owning* company of the folder to
    // preserve the invariant that swipe_files.company_id = swipe_types.company_id
    // for their type. That keeps per-folder storage and downstream queries
    // clean; partners still get read + edit + delete on the file via the
    // shared-folder access check.
    const access = await fetchAccessibleType(supabase, type_id, auth.companyId);
    if (!access) return NextResponse.json({ error: 'Type not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('swipe_files')
      .insert({
        company_id: access.type.company_id,
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

    if (error) {
      console.error('[api/ads/swipe/files] POST:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Swipe files POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
