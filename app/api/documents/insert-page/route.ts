// app/api/documents/insert-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { insertPage } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { document_id, after_page, temp_path } = await req.json();

    if (!document_id || isNaN(parseInt(after_page)) || !temp_path) {
      return NextResponse.json(
        { error: 'Missing document_id, after_page, or temp_path' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const result = await insertPage(supabase, 'document', {
      entityId:  document_id,
      afterPage: parseInt(after_page),
      tempPath:  temp_path,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }

    return NextResponse.json({
      success:        true,
      inserted_after: parseInt(after_page),
      pages_inserted: result.pagesInserted,
      total_pages:    result.totalPages,
    });
  } catch (err) {
    console.error('Documents insert page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}