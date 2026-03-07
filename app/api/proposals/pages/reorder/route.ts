// app/api/proposals/pages/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { reorderPages } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

/* ─── POST — batch reorder pages ─────────────────────────────────────────── */
/*
 * Body: { proposal_id: string, ordered_ids: string[] }
 * ordered_ids is the full ordered array of page IDs — position is assigned by index.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase                      = createServiceClient();
    const { proposal_id, ordered_ids }  = await req.json();

    if (!proposal_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json(
        { error: 'proposal_id and ordered_ids (array) are required' },
        { status: 400 },
      );
    }

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