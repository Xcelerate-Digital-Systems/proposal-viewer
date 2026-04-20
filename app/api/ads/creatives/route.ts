// app/api/ads/creatives/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/* ─── GET — list creatives with filtering/sorting/pagination ──────────────── */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const trackerId = params.get('tracker_id');
    const clientId = params.get('client_id');
    const status = params.get('status');
    const winner = params.get('winner');
    const mediaType = params.get('media_type');
    const awarenessLevel = params.get('awareness_level');
    const search = params.get('search');
    const sortBy = params.get('sort_by') || 'sort_order';
    const sortDir = params.get('sort_dir') || 'asc';
    const page = parseInt(params.get('page') || '1', 10);
    const perPage = Math.min(parseInt(params.get('per_page') || '100', 10), 500);

    const supabase = createServiceClient();
    let query = supabase
      .from('ad_creatives')
      .select('*, ad_copy_variants(*)', { count: 'exact' })
      .eq('company_id', auth.companyId);

    if (trackerId) query = query.eq('tracker_id', trackerId);

    // When filtering by client, resolve the client's tracker ids first and
    // scope to them. Returns an empty result set when the client has no
    // trackers yet — rather than returning every tracker in the agency.
    if (clientId && !trackerId) {
      const { data: clientTrackers } = await supabase
        .from('ad_trackers')
        .select('id')
        .eq('client_id', clientId)
        .eq('company_id', auth.companyId);
      const trackerIds = (clientTrackers ?? []).map((t: { id: string }) => t.id);
      if (trackerIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
        });
      }
      query = query.in('tracker_id', trackerIds);
    }
    if (status) query = query.eq('status', status);
    if (winner) query = query.eq('winner', winner);
    if (mediaType) query = query.eq('media_type', mediaType);
    if (awarenessLevel) query = query.eq('awareness_level', awarenessLevel);
    if (search) query = query.ilike('ad_name', `%${search}%`);

    const ascending = sortDir !== 'desc';
    query = query.order(sortBy, { ascending });

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (err) {
    console.error('Ad creatives GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — create a creative ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { variants, ...creativeData } = body;

    if (!creativeData.ad_name || !creativeData.tracker_id) {
      return NextResponse.json({ error: 'ad_name and tracker_id are required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify tracker belongs to this company
    const { data: tracker } = await supabase
      .from('ad_trackers')
      .select('id')
      .eq('id', creativeData.tracker_id)
      .eq('company_id', auth.companyId)
      .single();

    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
    }

    // Get next sort order
    const { count } = await supabase
      .from('ad_creatives')
      .select('*', { count: 'exact', head: true })
      .eq('tracker_id', creativeData.tracker_id);

    const { data: creative, error } = await supabase
      .from('ad_creatives')
      .insert({
        ...creativeData,
        company_id: auth.companyId,
        sort_order: count || 0,
        created_by: auth.member.user_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert copy variants if provided
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantRows = variants.map((v: Record<string, unknown>, i: number) => ({
        ad_creative_id: creative.id,
        variant_type: v.variant_type,
        label: v.label,
        content: v.content,
        sort_order: i,
      }));

      await supabase.from('ad_copy_variants').insert(variantRows);
    }

    // Re-fetch with variants
    const { data: fullCreative } = await supabase
      .from('ad_creatives')
      .select('*, ad_copy_variants(*)')
      .eq('id', creative.id)
      .single();

    return NextResponse.json({ success: true, data: fullCreative }, { status: 201 });
  } catch (err) {
    console.error('Ad creatives POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
