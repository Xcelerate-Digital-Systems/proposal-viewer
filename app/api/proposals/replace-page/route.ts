// app/api/proposals/replace-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/proposals/replace-page
 *
 * Replaces a single page in a proposal or document.
 *
 * The client has already uploaded the replacement PDF to a temp path in
 * Supabase Storage (via uploadTempPdf in usePdfOperations). This route:
 *   1. Finds the proposal_pages / document_pages row for the target page
 *   2. Deletes the old storage file (fire-and-forget)
 *   3. Updates file_path on the row to point to the temp file
 *      (the temp file becomes the permanent file — no copy needed)
 *
 * No PDF download, no pdf-lib, no merged-file rewrite.
 *
 * Body:
 *   proposal_id  string  — UUID of the proposal or document
 *   page_number  number  — 1-based page number to replace
 *   table_name   string  — 'proposals' | 'documents' (default: 'proposals')
 *   temp_path    string  — storage path of the replacement file
 *                          (already uploaded by the client)
 *
 * Response:
 *   { success: true, page_number: number, total_pages: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      proposal_id: proposalId,
      table_name: tableNameRaw,
      page_number,
      temp_path,
    } = body;

    const entityType = tableNameRaw === 'documents' ? 'document' : 'proposal';
    const pagesTable = entityType === 'document' ? 'document_pages' : 'proposal_pages';
    const idColumn   = entityType === 'document' ? 'document_id'    : 'proposal_id';
    const pageNumber = parseInt(page_number);

    if (!proposalId || !pageNumber || !temp_path) {
      return NextResponse.json(
        { error: 'Missing proposal_id, page_number, or temp_path' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // ── Fetch the target page row ─────────────────────────────────────────
    const { data: targetPage, error: pageError } = await supabase
      .from(pagesTable)
      .select('id, page_number, file_path')
      .eq(idColumn, proposalId)
      .eq('page_number', pageNumber)
      .single();

    if (pageError || !targetPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const oldFilePath = targetPage.file_path;

    // ── Update the row to point to the new file ───────────────────────────
    // The temp file is already in the 'proposals' bucket — we just update
    // the DB reference. The temp path becomes the permanent path.
    const { error: updateError } = await supabase
      .from(pagesTable)
      .update({ file_path: temp_path })
      .eq('id', targetPage.id);

    if (updateError) {
      // Clean up the temp file we'll never use now (fire-and-forget)
      supabase.storage.from('proposals').remove([temp_path]).catch(() => {});
      return NextResponse.json({ error: 'Failed to update page record' }, { status: 500 });
    }

    // ── Delete the old storage file ───────────────────────────────────────
    // Fire-and-forget: a missing or already-deleted file is not fatal.
    if (oldFilePath && oldFilePath !== temp_path) {
      supabase.storage
        .from('proposals')
        .remove([oldFilePath])
        .catch((err) =>
          console.error(`Non-fatal: failed to delete old page file ${oldFilePath}:`, err),
        );
    }

    // ── Return total page count ───────────────────────────────────────────
    const { count } = await supabase
      .from(pagesTable)
      .select('*', { count: 'exact', head: true })
      .eq(idColumn, proposalId);

    return NextResponse.json({
      success:     true,
      page_number: pageNumber,
      total_pages: count ?? 0,
    });
  } catch (err) {
    console.error('Replace page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}