// app/api/proposals/page-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase-server';
import { getPageUrls, PageUrlEntry } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

type PageUrlsResult = { pages: PageUrlEntry[]; fallback: boolean; error?: string };

export async function GET(req: NextRequest) {
  noStore(); // Prevent Next.js Data Cache from caching Supabase fetch calls
  try {
    const { searchParams } = req.nextUrl;
    const shareToken = searchParams.get('share_token');
    const entityId   = searchParams.get('entity_id');

    if (!shareToken && !entityId) {
      return NextResponse.json(
        { error: 'Provide either share_token or entity_id' },
        { status: 400, headers: NO_CACHE },
      );
    }

    const supabase = createServiceClient();
    const result = await getPageUrls(supabase, 'proposal', { entityId, shareToken }) as PageUrlsResult;

    if (result.error && !result.fallback) {
      const status = result.error === 'Not found' ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status, headers: NO_CACHE });
    }

    return NextResponse.json(
      { pages: result.pages, fallback: result.fallback },
      { headers: NO_CACHE },
    );
  } catch (err) {
    console.error('page-urls route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE },
    );
  }
}