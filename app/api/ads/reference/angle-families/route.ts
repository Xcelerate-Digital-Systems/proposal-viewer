// app/api/ads/reference/angle-families/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('ad_angle_families')
      .select('*')
      .eq('company_id', auth.companyId)
      .order('sort_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Angle families GET error:', err);
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
    const { data, error } = await supabase
      .from('ad_angle_families')
      .insert({
        company_id: auth.companyId,
        name: body.name.trim(),
        category: body.category?.trim() || null,
        description: body.description?.trim() || null,
        example_hooks: body.example_hooks || [],
        sort_order: body.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Angle families POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
