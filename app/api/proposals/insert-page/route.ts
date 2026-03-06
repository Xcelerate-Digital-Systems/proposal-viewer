// app/api/proposals/insert-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/proposals/insert-page
 *
 * Inserts a new page into a proposal or document at a given position.
 *
 * The client has already uploaded the new page PDF to a temp path in
 * Supabase Storage (via uploadTempPdf in usePdfOperations). This route:
 *   1. Fetches existing page rows
 *   2. Shifts all rows at/after the target position up by 1 (descending pass
 *      to avoid unique constraint conflicts)
 *   3. Inserts a new row pointing to the temp file
 *      (temp path becomes permanent — no copy needed)
 *
 * No PDF download, no pdf-lib, no merged-file rewrite.
 *
 * Body:
 *   proposal_id  string  — UUID of the proposal or document
 *   after_page   number  — 0-based index at which to insert
 *                          e.g. 0 = prepend (new page becomes page 1)
 *                               2 = insert at position 2 (0-based), new page becomes page 3
 *   table_name   string  — 'proposals' | 'documents' (default: 'proposals')
 *   temp_path    string  — storage path of the new page file (already uploaded)
 *
 * Response:
 *   { success: true, inserted_after: number, pages_inserted: 1, total_pages: number }
 *
 * Note: only single-page inserts are supported (pages_inserted always 1).
 * Multi-page insert would require the client to upload each page separately
 * and pass an array of temp_paths — not needed for current UI flows.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      proposal_id: proposalId,
      table_name: tableNameRaw,
      after_page,
      temp_path,
    } = body;

    const entityType  = tableNameRaw === 'documents' ? 'document' : 'proposal';
    const pagesTable  = entityType === 'document' ? 'document_pages' : 'proposal_pages';
    const idColumn    = entityType === 'document' ? 'document_id'    : 'proposal_id';
    const afterPage   = parseInt(after_page);

    if (!proposalId || isNaN(afterPage) || !temp_path) {
      return NextResponse.json(
        { error: 'Missing proposal_id, after_page, or temp_path' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // ── Resolve company_id (required for row insert due to RLS) ──────────
    const entityTable = entityType === 'document' ? 'documents' : 'proposals';
    const { data: entity, error: entityError } = await supabase
      .from(entityTable)
      .select('id, company_id')
      .eq('id', proposalId)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: `${entityType} not found` }, { status: 404 });
    }

    // ── Fetch all existing page rows ─────────────────────────────────────
    const { data: existingPages, error: pagesError } = await supabase
      .from(pagesTable)
      .select('id, page_number')
      .eq(idColumn, proposalId)
      .order('page_number', { ascending: true });

    if (pagesError) {
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    const totalPages  = existingPages?.length ?? 0;
    // after_page is 0-based: new page ends up at 1-based position (afterPage + 1)
    const newPageNum  = afterPage + 1;

    if (afterPage < 0 || afterPage > totalPages) {
      return NextResponse.json(
        { error: `Invalid position. ${entityType} has ${totalPages} pages.` },
        { status: 400 },
      );
    }

    // ── Shift existing rows at/after the target position up by 1 ─────────
    // Process in descending page_number order to avoid unique constraint
    // conflicts (same pattern as template page insert).
    const pagesToShift = (existingPages ?? [])
      .filter((p) => p.page_number >= newPageNum)
      .sort((a, b) => b.page_number - a.page_number); // descending

    for (const page of pagesToShift) {
      await supabase
        .from(pagesTable)
        .update({ page_number: page.page_number + 1 })
        .eq('id', page.id);
    }

    // ── Insert the new page row ───────────────────────────────────────────
    // The temp path becomes the permanent file_path — no storage move needed.
    const { error: insertError } = await supabase
      .from(pagesTable)
      .insert({
        [idColumn]:   proposalId,
        company_id:   entity.company_id,
        page_number:  newPageNum,
        file_path:    temp_path,
        label:        `Page ${newPageNum}`,
        indent:       0,
      });

    if (insertError) {
      // Roll back the shift if insert fails
      console.error('Insert page row failed, rolling back shift:', insertError.message);
      for (const page of pagesToShift) {
        await supabase
          .from(pagesTable)
          .update({ page_number: page.page_number })
          .eq('id', page.id);
      }
      return NextResponse.json({ error: 'Failed to insert page record' }, { status: 500 });
    }

    return NextResponse.json({
      success:        true,
      inserted_after: afterPage,
      pages_inserted: 1,
      total_pages:    totalPages + 1,
    });
  } catch (err) {
    console.error('Insert page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}