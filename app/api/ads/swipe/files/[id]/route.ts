// app/api/ads/swipe/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS = [
  'title', 'notes', 'headline', 'primary_text', 'description', 'cta', 'tags',
  'media_type', 'media_url', 'media_source', 'thumbnail_url', 'source_url', 'brand',
  'type_id', 'sort_order', 'has_been_shared', 'transcription', 'ai_prompt',
] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      if (body[f] === undefined) continue;
      const v = body[f];
      if (f === 'tags') {
        updates.tags = Array.isArray(v) ? v.map((t) => String(t).trim()).filter(Boolean) : [];
      } else if (typeof v === 'string') {
        updates[f] = v.trim() || null;
      } else {
        updates[f] = v;
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('swipe_files')
      .update(updates)
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Swipe file not found' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Swipe file PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('swipe_files')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Swipe file DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
