// app/api/templates/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

// Add a new page to a template (uploaded as PDF, extracts first page)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const templateId = formData.get('template_id') as string;
    const pageNumber = parseInt(formData.get('page_number') as string);
    const label = (formData.get('label') as string) || 'New Page';
    const file = formData.get('file') as File;

    if (!templateId || !pageNumber || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Extract first page from uploaded PDF
    const pdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [0]);
    singlePageDoc.addPage(copiedPage);
    const singlePageBytes = await singlePageDoc.save();

    const pagePath = `templates/${templateId}/page-${pageNumber}.pdf`;

    // Upload the page
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(pagePath, singlePageBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload page' }, { status: 500 });
    }

    // Shift existing pages if inserting (not replacing)
    const { data: existingPage } = await supabase
      .from('template_pages')
      .select('id')
      .eq('template_id', templateId)
      .eq('page_number', pageNumber)
      .single();

    if (!existingPage) {
      // Inserting new — shift pages at and after this position up by 1
      const { data: laterPages } = await supabase
        .from('template_pages')
        .select('*')
        .eq('template_id', templateId)
        .gte('page_number', pageNumber)
        .order('page_number', { ascending: false });

      if (laterPages && laterPages.length > 0) {
        for (const p of laterPages) {
          const newNum = p.page_number + 1;
          const newPath = `templates/${templateId}/page-${newNum}.pdf`;
          // Move file in storage
          await supabase.storage.from('proposals').move(p.file_path, newPath);
          // Update record
          await supabase.from('template_pages')
            .update({ page_number: newNum, file_path: newPath })
            .eq('id', p.id);
        }
      }
    }

    // Upsert the page record
    await supabase.from('template_pages').upsert({
      template_id: templateId,
      page_number: pageNumber,
      file_path: pagePath,
      label,
    }, { onConflict: 'template_id,page_number' });

    // Update template page count
    const { count } = await supabase
      .from('template_pages')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', templateId);

    await supabase.from('proposal_templates')
      .update({ page_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', templateId);

    return NextResponse.json({ success: true, page_number: pageNumber });
  } catch (err) {
    console.error('Page operation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a page from a template
export async function DELETE(req: NextRequest) {
  try {
    const { template_id, page_number } = await req.json();

    if (!template_id || !page_number) {
      return NextResponse.json({ error: 'Missing template_id or page_number' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get the page to delete
    const { data: page } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', template_id)
      .eq('page_number', page_number)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Remove file from storage
    await supabase.storage.from('proposals').remove([page.file_path]);

    // Delete record
    await supabase.from('template_pages').delete().eq('id', page.id);

    // Shift later pages down
    const { data: laterPages } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', template_id)
      .gt('page_number', page_number)
      .order('page_number', { ascending: true });

    if (laterPages && laterPages.length > 0) {
      for (const p of laterPages) {
        const newNum = p.page_number - 1;
        const newPath = `templates/${template_id}/page-${newNum}.pdf`;
        await supabase.storage.from('proposals').move(p.file_path, newPath);
        await supabase.from('template_pages')
          .update({ page_number: newNum, file_path: newPath })
          .eq('id', p.id);
      }
    }

    // Update page count
    const { count } = await supabase
      .from('template_pages')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', template_id);

    await supabase.from('proposal_templates')
      .update({ page_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', template_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}