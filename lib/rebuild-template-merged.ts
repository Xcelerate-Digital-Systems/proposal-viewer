// lib/rebuild-template-merged.ts
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * Merges all template_pages_v2 PDF rows into a single PDF and stores it as
 * proposal_templates.file_path. Call this after any page CRUD
 * operation (add, delete, replace, reorder).
 *
 * Returns the merged file path or null if no pages exist.
 */
export async function rebuildTemplateMerged(templateId: string): Promise<string | null> {
  const supabase = createServiceClient();

  // 1. Fetch all PDF template pages in order
  // FIXED: template_pages_v2 uses `position` (not `page_number`) and stores
  // the file path inside `payload->>'file_path'` (not a top-level column).
  // Also filter to type='pdf' and enabled=true — only PDF rows have files.
  const { data: pages, error: pagesError } = await supabase
    .from('template_pages_v2')
    .select('id, position, payload')
    .eq('template_id', templateId)
    .eq('type', 'pdf')
    .eq('enabled', true)
    .order('position', { ascending: true });

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
    // FIXED: file path lives in payload.file_path, not page.file_path
    const filePath = (page.payload as { file_path?: string })?.file_path;
    if (!filePath) {
      console.error(`rebuildTemplateMerged: No file_path in payload for page at position ${page.position}`);
      continue;
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('proposals')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error(`rebuildTemplateMerged: Failed to download page at position ${page.position}:`, downloadError);
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