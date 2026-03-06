// lib/split-proposal-pages.ts
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';
import { normalizePageNamesWithGroups } from '@/lib/supabase';

export type SplitEntityType = 'proposal' | 'document';

interface SplitResult {
  pageCount: number;
  skipped: boolean; // true if pages already existed and force was not set
}

/**
 * Downloads the merged PDF for a proposal or document, splits it into
 * individual single-page PDFs, uploads each to Supabase Storage, and
 * inserts rows into proposal_pages / document_pages.
 *
 * This is the backfill engine. It mirrors what app/api/templates/split
 * does for templates, but operates on already-created proposals/documents.
 *
 * Safe to call multiple times — existing page rows are deleted first so
 * the operation is fully idempotent.
 *
 * @param entityId   UUID of the proposal or document
 * @param entityType 'proposal' | 'document'
 * @param force      If false (default), skip entities that already have
 *                   page rows. Set to true to re-split unconditionally.
 */
export async function splitProposalPages(
  entityId: string,
  entityType: SplitEntityType,
  force = false,
): Promise<SplitResult> {
  const supabase = createServiceClient();

  const tableName    = entityType === 'document' ? 'documents'      : 'proposals';
  const pagesTable   = entityType === 'document' ? 'document_pages' : 'proposal_pages';
  const idColumn     = entityType === 'document' ? 'document_id'    : 'proposal_id';
  const storageDir   = entityType === 'document' ? 'documents'      : 'proposals';

  // ── 1. Fetch the parent record ──────────────────────────────────────────────
  const { data: entity, error: entityError } = await supabase
    .from(tableName)
    .select('id, file_path, page_names, company_id')
    .eq('id', entityId)
    .single();

  if (entityError || !entity) {
    throw new Error(`splitProposalPages: ${entityType} ${entityId} not found`);
  }

  if (!entity.file_path) {
    throw new Error(`splitProposalPages: ${entityType} ${entityId} has no file_path`);
  }

  // ── 2. Check for existing pages ─────────────────────────────────────────────
  const { count: existingCount } = await supabase
    .from(pagesTable)
    .select('*', { count: 'exact', head: true })
    .eq(idColumn, entityId);

  if ((existingCount ?? 0) > 0 && !force) {
    return { pageCount: existingCount ?? 0, skipped: true };
  }

  // ── 3. Download merged PDF ──────────────────────────────────────────────────
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('proposals')
    .download(entity.file_path);

  if (downloadError || !fileData) {
    throw new Error(`splitProposalPages: failed to download ${entity.file_path}: ${downloadError?.message}`);
  }

  const pdfBytes = await fileData.arrayBuffer();
  const pdfDoc   = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  // ── 4. Extract labels from existing page_names ──────────────────────────────
  // page_names is a JSONB array of { name, indent, type?, link_url?, link_label? }.
  // Groups (type: 'group') are sidebar-only — skip them when mapping to PDF pages.
  const rawPageNames = Array.isArray(entity.page_names) ? entity.page_names : [];
  const normalised   = normalizePageNamesWithGroups(rawPageNames, pageCount);
  const pdfEntries   = normalised.filter((e: { type?: string }) => e.type !== 'group');

  const getLabel = (pageIndex: number): string =>
    (pdfEntries[pageIndex] as { name?: string } | undefined)?.name?.trim() || `Page ${pageIndex + 1}`;

  const getIndent = (pageIndex: number): number =>
    (pdfEntries[pageIndex] as { indent?: number } | undefined)?.indent ?? 0;

  const getLinkUrl = (pageIndex: number): string | null =>
    (pdfEntries[pageIndex] as { link_url?: string } | undefined)?.link_url ?? null;

  const getLinkLabel = (pageIndex: number): string | null =>
    (pdfEntries[pageIndex] as { link_label?: string } | undefined)?.link_label ?? null;

  // ── 5. Delete any existing page rows (idempotent re-split) ──────────────────
  if ((existingCount ?? 0) > 0) {
    await supabase.from(pagesTable).delete().eq(idColumn, entityId);
  }

  // ── 6. Split, upload, and collect insert rows ───────────────────────────────
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < pageCount; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage]  = await singlePageDoc.copyPages(pdfDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const singlePageBytes = await singlePageDoc.save();

    // Sanitize: only allow alphanum, dots, hyphens, underscores in storage paths
    const sanitizedId = entityId.replace(/[^a-zA-Z0-9._-]/g, '');
    const pagePath    = `${storageDir}/${sanitizedId}/page-${i + 1}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(pagePath, singlePageBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      // Log but continue — a partial backfill is better than a full abort.
      // The split endpoint response will show pageCount vs actual rows inserted.
      console.error(`splitProposalPages: upload failed for page ${i + 1}:`, uploadError.message);
      continue;
    }

    const row: Record<string, unknown> = {
      [idColumn]:   entityId,
      company_id:   entity.company_id,
      page_number:  i + 1,
      file_path:    pagePath,
      label:        getLabel(i),
      indent:       getIndent(i),
    };

    const linkUrl   = getLinkUrl(i);
    const linkLabel = getLinkLabel(i);
    if (linkUrl)   row.link_url   = linkUrl;
    if (linkLabel) row.link_label = linkLabel;

    rows.push(row);
  }

  // ── 7. Batch insert ─────────────────────────────────────────────────────────
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from(pagesTable).insert(rows);
    if (insertError) {
      throw new Error(`splitProposalPages: failed to insert page rows: ${insertError.message}`);
    }
  }

  return { pageCount: rows.length, skipped: false };
}