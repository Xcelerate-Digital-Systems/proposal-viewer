// app/api/ads/target-markets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const trackerId = req.nextUrl.searchParams.get('tracker_id');

    const supabase = createServiceClient();
    let query = supabase
      .from('ad_target_markets')
      .select('*')
      .eq('company_id', auth.companyId)
      .order('sort_order', { ascending: true });

    if (trackerId) {
      query = query.eq('tracker_id', trackerId);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Target markets GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const supabase = createServiceClient();

    let countQuery = supabase
      .from('ad_target_markets')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', auth.companyId);

    if (body.tracker_id) {
      countQuery = countQuery.eq('tracker_id', body.tracker_id);
    }

    const { count } = await countQuery;

    const { data, error } = await supabase
      .from('ad_target_markets')
      .insert({
        company_id: auth.companyId,
        tracker_id: body.tracker_id || null,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        sort_order: count || 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Target markets POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
