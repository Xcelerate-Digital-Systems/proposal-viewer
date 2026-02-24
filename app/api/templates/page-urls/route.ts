// app/api/templates/page-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/page-urls?template_id=xxx
 *
 * Returns signed URLs for each individual template page PDF.
 * No merging — each page is served as its own single-page PDF.
 */
export async function GET(req: NextRequest) {
  try {
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch all template pages ordered by page_number
    const { data: pages, error: pagesError } = await supabase
      .from('template_pages')
      .select('id, page_number, file_path')
      .eq('template_id', templateId)
      .order('page_number', { ascending: true });

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages found for template' }, { status: 404 });
    }

    // Generate signed URLs for all pages in one batch
    const filePaths = pages.map((p) => p.file_path);
    const { data: signedUrls, error: signError } = await supabase.storage
      .from('proposals')
      .createSignedUrls(filePaths, 3600);

    if (signError || !signedUrls) {
      console.error('Failed to generate signed URLs:', signError);
      return NextResponse.json({ error: 'Failed to generate page URLs' }, { status: 500 });
    }

    // Build a map: pageNumber -> signedUrl
    const pageUrls: Record<number, string> = {};
    for (let i = 0; i < pages.length; i++) {
      const signed = signedUrls[i];
      if (signed?.signedUrl) {
        pageUrls[pages[i].page_number] = signed.signedUrl;
      }
    }

    return NextResponse.json({
      page_urls: pageUrls,
      page_count: pages.length,
    });
  } catch (err) {
    console.error('Page URLs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}