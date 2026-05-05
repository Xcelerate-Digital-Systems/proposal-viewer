// app/api/templates/page-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getPageUrls, PageUrlEntry } from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

type PageUrlsResult = { pages: PageUrlEntry[]; fallback: boolean; error?: string };

export async function GET(req: NextRequest) {
  noStore(); // Prevent Next.js Data Cache from caching Supabase fetch calls
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

    const { searchParams } = req.nextUrl;
    const entityId = searchParams.get('entity_id');

    if (!entityId) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400, headers: NO_CACHE },
      );
    }

    const supabase = createServiceClient();

    // Verify the template belongs to the caller's company.
    const { data: tmpl } = await supabase
      .from('proposal_templates')
      .select('id')
      .eq('id', entityId)
      .eq('company_id', auth.companyId)
      .maybeSingle();
    if (!tmpl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_CACHE });
    }

    const result = await getPageUrls(supabase, 'template', { entityId }) as PageUrlsResult;

    if (result.error && !result.fallback) {
      const status = result.error === 'Not found' ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status, headers: NO_CACHE });
    }

    return NextResponse.json(
      { pages: result.pages, fallback: result.fallback },
      { headers: NO_CACHE },
    );
  } catch (err) {
    console.error('Templates page-urls route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE },
    );
  }
}