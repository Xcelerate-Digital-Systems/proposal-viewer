// app/api/ads/swipe/types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { corsPreflight, withCors } from '@/lib/cors';
import { getPartnerCompanyIds, visibleTypesOrFilter } from '@/lib/swipe-files/access';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return corsPreflight();
}

/* ─── GET — list type folders with file counts ──────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    // Fetch everything the caller can see: own folders + folders explicitly
    // shared with them. Own folders sort first so the user's own structure
    // stays stable; shared folders then sort by their owner's sort_order.
    const { data: types, error } = await supabase
      .from('swipe_types')
      .select('*')
      .or(visibleTypesOrFilter(auth.companyId))
      .order('company_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const typeIds = (types || []).map((t) => t.id);
    // File counts cover every visible type — a partner viewing a shared folder
    // should see the real count, not zero.
    const { data: files } = typeIds.length
      ? await supabase.from('swipe_files').select('type_id').in('type_id', typeIds)
      : { data: [] as { type_id: string }[] };

    const counts = new Map<string, number>();
    (files || []).forEach((f: { type_id: string }) => {
      counts.set(f.type_id, (counts.get(f.type_id) || 0) + 1);
    });

    // Own folders first, then shared folders, preserving the owner's ordering
    // inside each group.
    const own = (types || []).filter((t) => t.company_id === auth.companyId);
    const shared = (types || []).filter((t) => t.company_id !== auth.companyId);
    const ordered = [...own, ...shared];

    const decorated = ordered.map((t) => ({ ...t, file_count: counts.get(t.id) || 0 }));

    return NextResponse.json({ success: true, data: decorated });
  } catch (err) {
    console.error('Swipe types GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — create type folder ─────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, description, shared_with_company_ids } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = createServiceClient();

    let shareList: string[] = [];
    if (shared_with_company_ids !== undefined) {
      if (!Array.isArray(shared_with_company_ids)) {
        return NextResponse.json({ error: 'shared_with_company_ids must be an array' }, { status: 400 });
      }
      shareList = Array.from(
        new Set(
          shared_with_company_ids
            .map((v: unknown) => String(v).trim())
            .filter((v: string) => UUID_RE.test(v) && v !== auth.companyId)
        )
      );

      if (shareList.length > 0) {
        const { data: memberships } = await supabase
          .from('team_members')
          .select('company_id')
          .eq('user_id', auth.member.user_id);
        const allowed = new Set((memberships || []).map((m: { company_id: string }) => m.company_id));
        if (shareList.some((id) => !allowed.has(id))) {
          return NextResponse.json(
            { error: 'You can only share with companies you belong to' },
            { status: 403 }
          );
        }
      }
    } else {
      // No explicit share list supplied — inherit whatever partner set this
      // company already uses on its existing folders. Skips the team_members
      // check because the value is derived from existing DB state rather
      // than user input.
      shareList = await getPartnerCompanyIds(supabase, auth.companyId);
    }

    const { data: existing } = await supabase
      .from('swipe_types')
      .select('sort_order')
      .eq('company_id', auth.companyId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextSort = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

    const { data, error } = await supabase
      .from('swipe_types')
      .insert({
        company_id: auth.companyId,
        name: name.trim(),
        description: description?.trim() || null,
        sort_order: nextSort,
        shared_with_company_ids: shareList,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('Swipe types POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
