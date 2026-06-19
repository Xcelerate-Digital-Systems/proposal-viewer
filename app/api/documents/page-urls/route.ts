// app/api/documents/page-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getPageUrls, PageUrlEntry } from '@/lib/page-operations';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

type PageUrlsResult = { pages: PageUrlEntry[]; fallback: boolean; error?: string };

export async function GET(req: NextRequest) {
  noStore(); // Prevent Next.js Data Cache from caching Supabase fetch calls
  try {
    const rl = await rateLimit({ key: `page-urls:${ipFromRequest(req)}`, limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_CACHE, ...rateLimitHeaders(rl, 60) } });
    }

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

    // When accessed by entity_id (admin path), require auth and verify
    // the document belongs to the caller's company.
    if (entityId && !shareToken) {
      const auth = await getAuthContext(req);
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
      }

      const { data: document } = await supabase
        .from('documents')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', auth.companyId)
        .maybeSingle();
      if (!document) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_CACHE });
      }
    }

    const result = await getPageUrls(supabase, 'document', { entityId, shareToken }) as PageUrlsResult;

    if (result.error && !result.fallback) {
      const status = result.error === 'Not found' ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status, headers: NO_CACHE });
    }

    return NextResponse.json(
      { pages: result.pages, fallback: result.fallback },
      { headers: NO_CACHE },
    );
  } catch (err) {
    console.error('Documents page-urls route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE },
    );
  }
}