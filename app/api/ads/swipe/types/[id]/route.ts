// app/api/ads/swipe/types/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.public_share_enabled !== undefined) updates.public_share_enabled = !!body.public_share_enabled;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();

    // Look up the existing row so we can block rename attempts on standard types.
    const { data: existing } = await supabase
      .from('swipe_types')
      .select('is_standard')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();
    if (!existing) return NextResponse.json({ error: 'Type not found' }, { status: 404 });

    if (existing.is_standard && updates.name !== undefined) {
      return NextResponse.json({ error: 'Standard ad types can\'t be renamed' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('swipe_types')
      .update(updates)
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Type not found' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Swipe type PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('swipe_types')
      .select('is_standard')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();
    if (!existing) return NextResponse.json({ error: 'Type not found' }, { status: 404 });

    if (existing.is_standard) {
      return NextResponse.json({ error: 'Standard ad types can\'t be deleted' }, { status: 403 });
    }

    const { error } = await supabase
      .from('swipe_types')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Swipe type DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
