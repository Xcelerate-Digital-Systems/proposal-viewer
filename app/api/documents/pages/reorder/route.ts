// app/api/documents/pages/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { reorderPages } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

/* ─── POST — batch reorder pages ─────────────────────────────────────────── */
/*
 * Body: { document_id: string, ordered_ids: string[] }
 * ordered_ids is the full ordered array of page IDs — position is assigned by index.
 * reorderPages scopes each UPDATE by document_id, so foreign page ids in the
 * list are silently no-ops; ownership of the document is sufficient.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase                     = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { document_id, ordered_ids } = body;

    if (!document_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json(
        { error: 'document_id and ordered_ids (array) are required' },
        { status: 400 },
      );
    }

    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: doc } = await supabase
      .from('documents')
      .select('company_id')
      .eq('id', document_id)
      .eq('company_id', auth.companyId)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
