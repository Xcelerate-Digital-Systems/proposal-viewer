// app/api/documents/page-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getPageUrls } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shareToken = searchParams.get('share_token');
    const entityId   = searchParams.get('entity_id');

    if (!shareToken && !entityId) {
      return NextResponse.json(
        { error: 'Provide either share_token or entity_id' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const result = await getPageUrls(supabase, 'document', { entityId, shareToken });

    if (result.error) {
      const status = result.error === 'Not found' ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ pages: result.pages }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Documents page-urls route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}