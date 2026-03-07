// app/api/documents/replace-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { replacePage } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { document_id, page_number, temp_path } = await req.json();

    if (!document_id || !page_number || !temp_path) {
      return NextResponse.json(
        { error: 'Missing document_id, page_number, or temp_path' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const result = await replacePage(supabase, 'document', {
      entityId:   document_id,
      pageNumber: parseInt(page_number),
      tempPath:   temp_path,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success:     true,
      page_number: parseInt(page_number),
      total_pages: result.totalPages,
    });
  } catch (err) {
    console.error('Documents replace page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}