// app/api/ads/creatives/by-name/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = [
  'hook_rate',
  'hold_rate',
  'uctr',
  'cvr',
  'cpl',
  'cpl_label',
] as const;

/* ─── GET — fetch a creative by ad_name ──────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ad_name = req.nextUrl.searchParams.get('ad_name')?.trim() ?? '';
    if (!ad_name) {
      return NextResponse.json({ error: 'ad_name query param is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: matches, error } = await supabase
      .from('ad_creatives')
      .select('*, ad_copy_variants(*)')
      .eq('company_id', auth.companyId)
      .eq('ad_name', ad_name);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { error: `No creative found with ad_name "${ad_name}"` },
        { status: 404 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        { error: 'Ambiguous ad_name', count: matches.length },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data: matches[0] });
  } catch (err) {
    console.error('Ad creative by-name GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── PATCH — update a creative's metrics by ad_name ──────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const ad_name = typeof body.ad_name === 'string' ? body.ad_name.trim() : '';
    if (!ad_name) {
      return NextResponse.json({ error: 'ad_name is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: `No updatable fields provided. Allowed: ${ALLOWED_FIELDS.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data: matches, error: lookupError } = await supabase
      .from('ad_creatives')
      .select('id')
      .eq('company_id', auth.companyId)
      .eq('ad_name', ad_name);

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { error: `No creative found with ad_name "${ad_name}"` },
        { status: 404 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        { error: 'Ambiguous ad_name', count: matches.length },
        { status: 409 },
      );
    }

    const id = matches[0].id;
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('ad_creatives')
      .update(updates)
      .eq('id', id)
      .eq('company_id', auth.companyId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data, error: fetchError } = await supabase
      .from('ad_creatives')
      .select('*, ad_copy_variants(*)')
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: 'Creative not found after update' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Ad creative by-name PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
