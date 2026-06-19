// app/api/ads/swipe/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { fetchAccessibleFile, fetchAccessibleType } from '@/lib/swipe-files/access';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS = [
  'title', 'notes', 'headline', 'primary_text', 'description', 'cta', 'tags',
  'media_type', 'media_url', 'media_source', 'thumbnail_url', 'source_url', 'brand',
  'type_id', 'sort_order', 'has_been_shared', 'transcription', 'ai_prompt',
] as const;

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'ads/swipe/files/[id]');
    if (limited) return limited;


    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
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

    // Access gate: caller must be able to access the file's current folder.
    const access = await fetchAccessibleFile(supabase, params.id, auth.companyId);
    if (!access) return NextResponse.json({ error: 'Swipe file not found' }, { status: 404 });

    // If the caller is moving the file between folders, they must also be
    // able to access the destination folder (own or shared). The file's
    // company_id follows the destination folder's owner so the invariant
    // (file.company_id = owning type.company_id) holds.
    if (typeof updates.type_id === 'string' && updates.type_id !== access.file.type_id) {
      const destAccess = await fetchAccessibleType(supabase, updates.type_id as string, auth.companyId);
      if (!destAccess) return NextResponse.json({ error: 'Destination type not found' }, { status: 404 });
      updates.company_id = destAccess.type.company_id;
    }

    const { data, error } = await supabase
      .from('swipe_files')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Swipe file not found' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Swipe file PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'ads/swipe/files/[id]');
    if (limited) return limited;


    const supabase = createServiceClient();

    const access = await fetchAccessibleFile(supabase, params.id, auth.companyId);
    if (!access) return NextResponse.json({ error: 'Swipe file not found' }, { status: 404 });

    const { error } = await supabase
      .from('swipe_files')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('[api/ads/swipe/files/[id]] DELETE:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Swipe file DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
