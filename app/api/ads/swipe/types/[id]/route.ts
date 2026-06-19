// app/api/ads/swipe/types/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'ads/swipe/types/[id]');
    if (limited) return limited;


    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.public_share_enabled !== undefined) updates.public_share_enabled = !!body.public_share_enabled;

    let shareList: string[] | undefined;
    if (body.shared_with_company_ids !== undefined) {
      if (!Array.isArray(body.shared_with_company_ids)) {
        return NextResponse.json({ error: 'shared_with_company_ids must be an array' }, { status: 400 });
      }
      const cleaned = Array.from(
        new Set(
          body.shared_with_company_ids
            .map((v: unknown) => String(v).trim())
            .filter((v: string) => UUID_RE.test(v) && v !== auth.companyId)
        )
      ) as string[];
      shareList = cleaned;
      updates.shared_with_company_ids = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();

    // PATCH is owner-only — partners can't rename/delete or change the share list.
    // The owner check is enforced by the .eq('company_id', auth.companyId) clause
    // on the UPDATE below; a non-owner's UPDATE simply matches zero rows.

    // Validate that every share target is a real company the caller is
    // actually a member of — prevents a user from broadcasting to random
    // companies they have no relationship with.
    if (shareList && shareList.length > 0) {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('company_id')
        .eq('user_id', auth.member.user_id);

      const allowed = new Set((memberships || []).map((m: { company_id: string }) => m.company_id));
      const bad = shareList.filter((id) => !allowed.has(id));
      if (bad.length > 0) {
        return NextResponse.json(
          { error: 'You can only share with companies you belong to' },
          { status: 403 }
        );
      }
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

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'ads/swipe/types/[id]');
    if (limited) return limited;


    const supabase = createServiceClient();

    const { error } = await supabase
      .from('swipe_types')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/ads/swipe/types/[id]] DELETE:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Swipe type DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
