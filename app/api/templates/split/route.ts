// app/api/templates/split/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { template_name, template_description, file_path, company_id } = await req.json();

    if (!template_name || !file_path || !company_id) {
      return NextResponse.json({ error: 'Missing template_name, file_path, or company_id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Download the uploaded PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('proposals')
      .download(file_path);

    if (downloadError || !fileData) {
      console.error('PDF download failed:', downloadError);
      return NextResponse.json({ error: 'Failed to download PDF. The upload may not have completed.' }, { status: 500 });
    }

    const pdfBytes = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    // Create the template record (without file_path yet — we set it after moving the file)
    const { data: template, error: templateError } = await supabase
      .from('proposal_templates')
      .insert({
        name: template_name,
        description: template_description || null,
        page_count: pageCount,
        company_id,
      })
      .select()
      .single();

    if (templateError || !template) {
      console.error('Template insert failed:', templateError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // Split each page into its own PDF (prepare all in memory first)
    const pageUploads: { index: number; bytes: Uint8Array; path: string }[] = [];
    for (let i = 0; i < pageCount; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePageBytes = await singlePageDoc.save();
      pageUploads.push({
        index: i,
        bytes: singlePageBytes,
        path: `templates/${template.id}/page-${i + 1}.pdf`,
      });
    }

    // Upload all pages in parallel (batches of 5 to avoid overwhelming storage)
    const pages: { template_id: string; page_number: number; file_path: string; label: string; company_id: string }[] = [];
    const BATCH_SIZE = 5;

    for (let batch = 0; batch < pageUploads.length; batch += BATCH_SIZE) {
      const chunk = pageUploads.slice(batch, batch + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async ({ index, bytes, path }) => {
          const { error: uploadError } = await supabase.storage
            .from('proposals')
            .upload(path, bytes, {
              contentType: 'application/pdf',
              upsert: true,
            });
          if (uploadError) {
            console.error(`Failed to upload page ${index + 1}:`, uploadError);
            throw uploadError;
          }
          return { index, path };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          pages.push({
            template_id: template.id,
            page_number: result.value.index + 1,
            file_path: result.value.path,
            label: `Page ${result.value.index + 1}`,
            company_id,
          });
        }
      }
    }

    // Insert all page records
    if (pages.length > 0) {
      const { error: pagesError } = await supabase.from('template_pages_v2').insert(pages);
      if (pagesError) {
        console.error('Failed to insert page records:', pagesError);
      }
    }

    // Move the original uploaded PDF to the template's merged path
    const mergedPath = `templates/${template.id}/merged.pdf`;
    const { error: copyError } = await supabase.storage
      .from('proposals')
      .copy(file_path, mergedPath);

    if (copyError) {
      console.error('Failed to copy merged PDF:', copyError);
      // Non-fatal: the rebuild-merged endpoint can regenerate it later
    }

    // Clean up the original upload location
    await supabase.storage.from('proposals').remove([file_path]);

    // Update template with the merged file_path
    await supabase
      .from('proposal_templates')
      .update({ file_path: copyError ? null : mergedPath })
      .eq('id', template.id);

    return NextResponse.json({ template_id: template.id, page_count: pageCount });
  } catch (err) {
    console.error('Split error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
