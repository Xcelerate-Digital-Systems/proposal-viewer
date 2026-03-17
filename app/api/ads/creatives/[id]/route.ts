// app/api/ads/creatives/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/* ─── GET — single creative with variants ─────────────────────────────────── */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('ad_creatives')
      .select('*, ad_copy_variants(*)')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Ad creative GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── PATCH — update creative ─────────────────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Separate variants from creative fields
    const { variants, ...updates } = body;
    delete updates.id;
    delete updates.company_id;
    delete updates.created_by;
    delete updates.created_at;
    delete updates.ad_copy_variants;

    const supabase = createServiceClient();

    // Update creative fields if any
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('ad_creatives')
        .update(updates)
        .eq('id', params.id)
        .eq('company_id', auth.companyId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Re-fetch with variants
    const { data, error: fetchError } = await supabase
      .from('ad_creatives')
      .select('*, ad_copy_variants(*)')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Ad creative PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── DELETE — delete creative ────────────────────────────────────────────── */

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('ad_creatives')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Ad creative DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
