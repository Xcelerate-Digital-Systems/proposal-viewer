// app/api/documents/pages/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { reorderPages } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

/* ─── POST — batch reorder pages ─────────────────────────────────────────── */
/*
 * Body: { document_id: string, ordered_ids: string[] }
 * ordered_ids is the full ordered array of page IDs — position is assigned by index.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase                    = createServiceClient();
    const { document_id, ordered_ids } = await req.json();

    if (!document_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json(
        { error: 'document_id and ordered_ids (array) are required' },
        { status: 400 },
      );
    }

    const { success, error } = await reorderPages(supabase, 'document', {
      entityId:   document_id,
      orderedIds: ordered_ids,
    });

    if (!success) {
      return NextResponse.json({ error: error ?? 'Reorder failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Document pages reorder error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}