// lib/rebuild-template-merged.ts
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * Merges all template_pages into a single PDF and stores it as
 * proposal_templates.file_path. Call this after any page CRUD
 * operation (add, delete, replace, reorder).
 *
 * Returns the merged file path or null if no pages exist.
 */
export async function rebuildTemplateMerged(templateId: string): Promise<string | null> {
  const supabase = createServiceClient();

  // 1. Fetch all template pages in order
  const { data: pages, error: pagesError } = await supabase
    .from('template_pages')
    .select('id, page_number, file_path')
    .eq('template_id', templateId)
    .order('page_number', { ascending: true });

  if (pagesError) {
    console.error('rebuildTemplateMerged: Failed to fetch pages:', pagesError);
    throw new Error('Failed to fetch template pages');
  }

  if (!pages || pages.length === 0) {
    // No pages — clear the file_path
    await supabase
      .from('proposal_templates')
      .update({ file_path: null, updated_at: new Date().toISOString() })
      .eq('id', templateId);
    return null;
  }

  // 2. Merge all pages into a single PDF
  const mergedDoc = await PDFDocument.create();

  for (const page of pages) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('proposals')
      .download(page.file_path);

    if (downloadError || !fileData) {
      console.error(`rebuildTemplateMerged: Failed to download page ${page.page_number}:`, downloadError);
      continue;
    }

    const pageBytes = await fileData.arrayBuffer();
    const pageDoc = await PDFDocument.load(pageBytes);
    const copiedPages = await mergedDoc.copyPages(pageDoc, pageDoc.getPageIndices());
    copiedPages.forEach((p) => mergedDoc.addPage(p));
  }

  const mergedBytes = await mergedDoc.save();

  // 3. Upload the merged PDF (upsert overwrites previous version)
  const mergedPath = `templates/${templateId}/merged.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('proposals')
    .upload(mergedPath, mergedBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('rebuildTemplateMerged: Failed to upload merged PDF:', uploadError);
    throw new Error('Failed to upload merged PDF');
  }

  // 4. Update the template record
  await supabase
    .from('proposal_templates')
    .update({
      file_path: mergedPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId);

  return mergedPath;
}