// app/api/proposals/reorder-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/proposals/reorder-pages
 *
 * Reorders pages for a proposal or document by updating page_number values
 * in proposal_pages / document_pages. Pure DB operation — no PDF download,
 * no pdf-lib, no storage writes.
 *
 * Body:
 *   proposal_id  string    — UUID of the proposal or document
 *   page_order   number[]  — 0-based indices representing the new order
 *                            e.g. [2, 0, 1] moves page 3 to position 1
 *   table_name   string    — 'proposals' | 'documents' (default: 'proposals')
 *
 * The two-pass approach (negative → positive) avoids unique constraint
 * conflicts on (proposal_id, page_number) during the update sequence,
 * identical to the template reorder pattern.
 */
export async function POST(req: NextRequest) {
  try {
    const { proposal_id, page_order, table_name } = await req.json();
    const entityType = table_name === 'documents' ? 'document' : 'proposal';
    const pagesTable = entityType === 'document' ? 'document_pages' : 'proposal_pages';
    const idColumn   = entityType === 'document' ? 'document_id'    : 'proposal_id';

    if (!proposal_id || !Array.isArray(page_order)) {
      return NextResponse.json(
        { error: 'Missing proposal_id or page_order' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Fetch all pages ordered by current page_number
    const { data: pages, error: pagesError } = await supabase
      .from(pagesTable)
      .select('id, page_number')
      .eq(idColumn, proposal_id)
      .order('page_number', { ascending: true });

    if (pagesError || !pages) {
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    const totalPages = pages.length;

    // Validate page_order length
    if (page_order.length !== totalPages) {
      return NextResponse.json(
        {
          error: `page_order length (${page_order.length}) must match page count (${totalPages})`,
        },
        { status: 400 },
      );
    }

    // Validate page_order contents: must be exactly 0..N-1 each appearing once
    const sorted   = [...page_order].sort((a: number, b: number) => a - b);
    const expected = Array.from({ length: totalPages }, (_, i) => i);
    if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
      return NextResponse.json(
        { error: 'page_order must contain each index exactly once (0-based)' },
        { status: 400 },
      );
    }

    // Short-circuit: nothing to do if order hasn't changed
    const isIdentity = page_order.every((v: number, i: number) => v === i);
    if (isIdentity) {
      return NextResponse.json({ success: true, reordered: false, total_pages: totalPages });
    }

    // ── Two-pass reorder ─────────────────────────────────────────────────────
    // Pass 1: set all page_numbers to negative to vacate the positive space
    // without triggering the unique constraint on (entity_id, page_number).
    for (let i = 0; i < totalPages; i++) {
      const origIdx = page_order[i];
      const page    = pages[origIdx];
      await supabase
        .from(pagesTable)
        .update({ page_number: -(i + 1) })
        .eq('id', page.id);
    }

    // Pass 2: set final positive page_numbers
    for (let i = 0; i < totalPages; i++) {
      const origIdx = page_order[i];
      const page    = pages[origIdx];
      await supabase
        .from(pagesTable)
        .update({ page_number: i + 1 })
        .eq('id', page.id);
    }

    return NextResponse.json({
      success:     true,
      reordered:   true,
      total_pages: totalPages,
    });
  } catch (err) {
    console.error('Reorder pages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}