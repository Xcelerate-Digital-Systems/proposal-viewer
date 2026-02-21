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
    const companyId = formData.get('company_id') as string;
    const file = formData.get('file') as File;
    const mode = (formData.get('mode') as string) || 'auto'; // 'insert' | 'replace' | 'auto'

    if (!templateId || !pageNumber || !file || !companyId) {
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

    // Check if a page already exists at this position
    const { data: existingPage } = await supabase
      .from('template_pages')
      .select('id')
      .eq('template_id', templateId)
      .eq('page_number', pageNumber)
      .single();

    const isReplace = mode === 'replace' || (mode === 'auto' && !!existingPage);
    const isInsert = mode === 'insert' || (mode === 'auto' && !existingPage);

    // If inserting, shift existing pages BEFORE uploading the new file.
    // Only update page_number — do NOT move files in storage.
    // File paths are just unique identifiers; the actual ordering comes from page_number.
    // Moving files in storage is fragile and can fail silently, causing DB/storage mismatches.
    if (isInsert && existingPage) {
      // There's a page at this slot — shift it and everything after it up by 1
      const { data: laterPages } = await supabase
        .from('template_pages')
        .select('id, page_number')
        .eq('template_id', templateId)
        .gte('page_number', pageNumber)
        .order('page_number', { ascending: false });

      if (laterPages && laterPages.length > 0) {
        // Process in descending order to avoid unique constraint conflicts
        for (const p of laterPages) {
          await supabase.from('template_pages')
            .update({ page_number: p.page_number + 1 })
            .eq('id', p.id);
        }
      }
    } else if (!isInsert && !existingPage) {
      // Nothing to replace — shift pages at and after this slot up by 1
      const { data: laterPages } = await supabase
        .from('template_pages')
        .select('id, page_number')
        .eq('template_id', templateId)
        .gte('page_number', pageNumber)
        .order('page_number', { ascending: false });

      if (laterPages && laterPages.length > 0) {
        for (const p of laterPages) {
          await supabase.from('template_pages')
            .update({ page_number: p.page_number + 1 })
            .eq('id', p.id);
        }
      }
    }

    // Use a unique filename to avoid collisions
    const pagePath = `templates/${templateId}/page-${pageNumber}-${Date.now()}.pdf`;

    // Upload the page
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(pagePath, singlePageBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload page' }, { status: 500 });
    }

    if (isReplace && existingPage) {
      // Replace — remove old file and update record
      const { data: oldPage } = await supabase
        .from('template_pages')
        .select('file_path')
        .eq('id', existingPage.id)
        .single();
      if (oldPage?.file_path) {
        await supabase.storage.from('proposals').remove([oldPage.file_path]);
      }
      await supabase.from('template_pages')
        .update({ file_path: pagePath, label })
        .eq('id', existingPage.id);
    } else {
      // Insert new record
      await supabase.from('template_pages').insert({
        template_id: templateId,
        page_number: pageNumber,
        file_path: pagePath,
        label,
        company_id: companyId,
      });
    }

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

    // Shift later pages down (only update page_number, keep files in place).
    // File paths are just unique identifiers — the actual ordering comes from page_number.
    // Moving files in storage is fragile and can fail silently, causing DB/storage mismatches.
    const { data: laterPages } = await supabase
      .from('template_pages')
      .select('id, page_number')
      .eq('template_id', template_id)
      .gt('page_number', page_number)
      .order('page_number', { ascending: true });

    if (laterPages && laterPages.length > 0) {
      // Process in ascending order so lower numbers are freed first
      for (const p of laterPages) {
        await supabase.from('template_pages')
          .update({ page_number: p.page_number - 1 })
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