// app/api/templates/merge-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/merge-pdf?template_id=xxx
 *
 * Merges all template pages into a single PDF and returns a signed URL.
 * The merged PDF is uploaded to a temp path in storage for caching.
 */
export async function GET(req: NextRequest) {
  try {
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify the template exists
    const { data: template, error: templateError } = await supabase
      .from('proposal_templates')
      .select('id, company_id, updated_at')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if a cached merged PDF exists and is still fresh
    const cachePath = `templates/${templateId}/merged-preview.pdf`;
    const { data: existingUrl } = await supabase.storage
      .from('proposals')
      .createSignedUrl(cachePath, 3600);

    // If cache exists, check if template was updated after the cache was created
    // We'll just regenerate every time for simplicity (the merge is fast)

    // Fetch all template pages ordered by page_number
    const { data: pages, error: pagesError } = await supabase
      .from('template_pages')
      .select('id, page_number, file_path')
      .eq('template_id', templateId)
      .order('page_number', { ascending: true });

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages found for template' }, { status: 404 });
    }

    // Create a new merged PDF
    const mergedPdf = await PDFDocument.create();

    for (const page of pages) {
      // Download each page PDF
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('proposals')
        .download(page.file_path);

      if (downloadError || !fileData) {
        console.error(`Failed to download page ${page.page_number}:`, downloadError);
        continue;
      }

      const pageBytes = await fileData.arrayBuffer();
      const pagePdf = await PDFDocument.load(pageBytes);
      const [copiedPage] = await mergedPdf.copyPages(pagePdf, [0]);
      mergedPdf.addPage(copiedPage);
    }

    const mergedBytes = await mergedPdf.save();

    // Upload merged PDF to temp storage
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(cachePath, mergedBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload merged PDF:', uploadError);
      return NextResponse.json({ error: 'Failed to create preview' }, { status: 500 });
    }

    // Get a signed URL for the merged PDF
    const { data: signedData } = await supabase.storage
      .from('proposals')
      .createSignedUrl(cachePath, 3600);

    if (!signedData?.signedUrl) {
      return NextResponse.json({ error: 'Failed to generate preview URL' }, { status: 500 });
    }

    return NextResponse.json({
      pdf_url: signedData.signedUrl,
      page_count: pages.length,
    });
  } catch (err) {
    console.error('Merge PDF error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}