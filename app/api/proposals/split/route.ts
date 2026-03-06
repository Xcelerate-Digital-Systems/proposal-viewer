// app/api/proposals/split/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { splitProposalPages, SplitEntityType } from '@/lib/split-proposal-pages';

export const dynamic = 'force-dynamic';

/**
 * POST /api/proposals/split
 *
 * Splits a merged proposal or document PDF into individual per-page files
 * and populates proposal_pages / document_pages.
 *
 * Use this to backfill existing proposals/documents, or to re-split a
 * specific record after a manual storage fix.
 *
 * Body:
 *   entity_id   string  — UUID of the proposal or document
 *   entity_type string  — 'proposal' | 'document'  (default: 'proposal')
 *   force       boolean — re-split even if page rows already exist (default: false)
 *
 * Example curl (single proposal):
 *   curl -X POST https://app.agencyviz.io/api/proposals/split \
 *     -H "Content-Type: application/json" \
 *     -d '{"entity_id":"<uuid>","entity_type":"proposal","force":false}'
 *
 * Example curl (backfill all proposals — run the SQL query below to get IDs,
 * then loop over them):
 *   SELECT id FROM proposals WHERE file_path IS NOT NULL ORDER BY created_at;
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entity_id, entity_type = 'proposal', force = false } = body;

    if (!entity_id || typeof entity_id !== 'string') {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 },
      );
    }

    const validTypes: SplitEntityType[] = ['proposal', 'document'];
    if (!validTypes.includes(entity_type)) {
      return NextResponse.json(
        { error: 'entity_type must be "proposal" or "document"' },
        { status: 400 },
      );
    }

    const result = await splitProposalPages(entity_id, entity_type as SplitEntityType, force);

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `${entity_type} already has ${result.pageCount} page rows. Pass force:true to re-split.`,
        page_count: result.pageCount,
      });
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      entity_id,
      entity_type,
      page_count: result.pageCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Split route error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}