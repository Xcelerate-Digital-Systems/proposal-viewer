// app/api/templates/split/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { template_name, template_description, file_path } = await req.json();

    if (!template_name || !file_path) {
      return NextResponse.json({ error: 'Missing template_name or file_path' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Download the uploaded PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('proposals')
      .download(file_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download PDF' }, { status: 500 });
    }

    const pdfBytes = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    // Create the template record
    const { data: template, error: templateError } = await supabase
      .from('proposal_templates')
      .insert({ name: template_name, description: template_description || null, page_count: pageCount })
      .select()
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // Split each page into its own PDF and upload
    const pages = [];
    for (let i = 0; i < pageCount; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePageBytes = await singlePageDoc.save();

      const pagePath = `templates/${template.id}/page-${i + 1}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('proposals')
        .upload(pagePath, singlePageBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Failed to upload page ${i + 1}:`, uploadError);
        continue;
      }

      pages.push({
        template_id: template.id,
        page_number: i + 1,
        file_path: pagePath,
        label: `Page ${i + 1}`,
      });
    }

    // Insert all page records
    if (pages.length > 0) {
      await supabase.from('template_pages').insert(pages);
    }

    // Clean up the original uploaded PDF
    await supabase.storage.from('proposals').remove([file_path]);

    return NextResponse.json({ template_id: template.id, page_count: pageCount });
  } catch (err) {
    console.error('Split error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}