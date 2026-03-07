// app/api/documents/reorder-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { reorderPages } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { document_id, page_order } = await req.json();

    if (!document_id || !Array.isArray(page_order)) {
      return NextResponse.json(
        { error: 'Missing document_id or page_order' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const result = await reorderPages(supabase, 'document', {
      entityId:  document_id,
      pageOrder: page_order,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }

    return NextResponse.json({
      success:     true,
      reordered:   result.reordered,
      total_pages: result.totalPages,
    });
  } catch (err) {
    console.error('Documents reorder pages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}