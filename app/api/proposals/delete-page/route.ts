// app/api/proposals/delete-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/proposals/delete-page
 *
 * Deletes a single page from a proposal or document.
 * - Removes the storage file for that page
 * - Deletes the proposal_pages / document_pages row
 * - Renumbers all later pages down by 1 (ascending pass, no constraint conflicts)
 *
 * No PDF download, no pdf-lib, no merged-file rewrite.
 *
 * Body:
 *   proposal_id  string  — UUID of the proposal or document
 *   page_number  number  — 1-based page number to delete
 *   table_name   string  — 'proposals' | 'documents' (default: 'proposals')
 *
 * Response:
 *   { success: true, deleted_page: number, total_pages: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { proposal_id, page_number, table_name } = await req.json();
    const entityType = table_name === 'documents' ? 'document' : 'proposal';
    const pagesTable = entityType === 'document' ? 'document_pages' : 'proposal_pages';
    const idColumn   = entityType === 'document' ? 'document_id'    : 'proposal_id';

    if (!proposal_id || !page_number) {
      return NextResponse.json(
        { error: 'Missing proposal_id or page_number' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // ── Fetch total page count ────────────────────────────────────────────
    const { data: allPages, error: countError } = await supabase
      .from(pagesTable)
      .select('id, page_number, file_path')
      .eq(idColumn, proposal_id)
      .order('page_number', { ascending: true });

    if (countError || !allPages) {
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    const totalPages = allPages.length;

    if (page_number < 1 || page_number > totalPages) {
      return NextResponse.json(
        { error: `Invalid page number. ${entityType} has ${totalPages} pages.` },
        { status: 400 },
      );
    }

    if (totalPages <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only remaining page.' },
        { status: 400 },
      );
    }

    // ── Find the target page row ──────────────────────────────────────────
    const targetPage = allPages.find((p) => p.page_number === page_number);
    if (!targetPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // ── Delete storage file (fire-and-forget — don't block on failure) ────
    // File may have already been cleaned up; a missing file is not fatal.
    supabase.storage
      .from('proposals')
      .remove([targetPage.file_path])
      .catch((err) =>
        console.error(`Non-fatal: failed to delete storage file ${targetPage.file_path}:`, err),
      );

    // ── Delete the page row ───────────────────────────────────────────────
    const { error: deleteError } = await supabase
      .from(pagesTable)
      .delete()
      .eq('id', targetPage.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete page record' }, { status: 500 });
    }

    // ── Renumber later pages down by 1 ────────────────────────────────────
    // Process in ascending page_number order so each decrement frees the
    // slot below it — no unique constraint conflicts without a two-pass needed.
    const laterPages = allPages
      .filter((p) => p.page_number > page_number)
      .sort((a, b) => a.page_number - b.page_number);

    for (const page of laterPages) {
      await supabase
        .from(pagesTable)
        .update({ page_number: page.page_number - 1 })
        .eq('id', page.id);
    }

    return NextResponse.json({
      success:      true,
      deleted_page: page_number,
      total_pages:  totalPages - 1,
    });
  } catch (err) {
    console.error('Delete page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}