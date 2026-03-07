// app/api/proposals/delete-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { deletePage } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { proposal_id, page_number } = await req.json();

    if (!proposal_id || !page_number) {
      return NextResponse.json(
        { error: 'Missing proposal_id or page_number' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const result = await deletePage(supabase, 'proposal', {
      entityId:   proposal_id,
      pageNumber: page_number,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }

    return NextResponse.json({
      success:      true,
      deleted_page: page_number,
      total_pages:  result.totalPages,
    });
  } catch (err) {
    console.error('Delete page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}