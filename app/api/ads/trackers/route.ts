// app/api/ads/trackers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/* ─── GET — list trackers for company ─────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('ad_trackers')
      .select('*, ad_creatives(count)')
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the count from the nested aggregate
    const trackers = (data || []).map((t: Record<string, unknown>) => ({
      ...t,
      creative_count: Array.isArray(t.ad_creatives) ? (t.ad_creatives[0] as Record<string, number>)?.count ?? 0 : 0,
      ad_creatives: undefined,
    }));

    return NextResponse.json({ success: true, data: trackers });
  } catch (err) {
    console.error('Ad trackers GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — create a tracker ─────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, description, client_id, client_name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('ad_trackers')
      .insert({
        company_id: auth.companyId,
        name: name.trim(),
        description: description?.trim() || null,
        client_id: client_id || null,
        client_name: client_name?.trim() || null,
        created_by: auth.member.user_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Ad trackers POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
