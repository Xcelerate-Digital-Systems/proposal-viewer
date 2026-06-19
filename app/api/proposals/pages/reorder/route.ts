// app/api/proposals/pages/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { reorderPages } from '@/lib/page-operations';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/* ─── POST — batch reorder pages ─────────────────────────────────────────── */
/*
 * Body: { proposal_id: string, ordered_ids: string[] }
 * ordered_ids is the full ordered array of page IDs — position is assigned by index.
 * reorderPages scopes each UPDATE by proposal_id, so foreign page ids in the
 * list are silently no-ops; ownership of the proposal is sufficient.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase                      = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { proposal_id, ordered_ids }  = body;

    if (!proposal_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json(
        { error: 'proposal_id and ordered_ids (array) are required' },
        { status: 400 },
      );
    }

    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'proposals/pages/reorder');
    if (limited) return limited;


    const { data: proposal } = await supabase
      .from('proposals')
      .select('company_id')
      .eq('id', proposal_id)
      .eq('company_id', auth.companyId)
      .maybeSingle();
    if (!proposal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success, error } = await reorderPages(supabase, 'proposal', {
      entityId:   proposal_id,
      orderedIds: ordered_ids,
    });

    if (!success) {
      return NextResponse.json({ error: error ?? 'Reorder failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Proposal pages reorder error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
