// app/api/proposals/page-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/proposals/page-urls
 *
 * Returns signed storage URLs for every page of a proposal or document,
 * ordered by page_number. Used by the viewer and the admin page editor.
 *
 * Two access modes — pass exactly one of:
 *
 *   ?share_token=<uuid>&entity_type=proposal   (viewer — unauthenticated)
 *   ?share_token=<uuid>&entity_type=document
 *
 *   ?entity_id=<uuid>&entity_type=proposal     (admin — authenticated context)
 *   ?entity_id=<uuid>&entity_type=document
 *
 * Response:
 *   {
 *     pages: Array<{
 *       page_number: number
 *       url:         string   // signed URL, valid for 1 hour
 *       label:       string
 *       indent:      number
 *       link_url?:   string
 *       link_label?: string
 *     }>
 *   }
 *
 * Falls back gracefully: if no proposal_pages rows exist yet (pre-backfill),
 * returns { pages: [], fallback: true } so the caller can fall back to the
 * legacy merged-PDF path.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shareToken  = searchParams.get('share_token');
    const entityId    = searchParams.get('entity_id');
    const entityType  = searchParams.get('entity_type') ?? 'proposal';

    if (entityType !== 'proposal' && entityType !== 'document') {
      return NextResponse.json(
        { error: 'entity_type must be "proposal" or "document"' },
        { status: 400 },
      );
    }

    if (!shareToken && !entityId) {
      return NextResponse.json(
        { error: 'Provide either share_token or entity_id' },
        { status: 400 },
      );
    }

    const supabase   = createServiceClient();
    const tableName  = entityType === 'document' ? 'documents'      : 'proposals';
    const pagesTable = entityType === 'document' ? 'document_pages' : 'proposal_pages';
    const idColumn   = entityType === 'document' ? 'document_id'    : 'proposal_id';

    // ── Resolve entity_id from share_token if needed ───────────────────────
    let resolvedId = entityId;

    if (!resolvedId && shareToken) {
      const { data: entity, error } = await supabase
        .from(tableName)
        .select('id')
        .eq('share_token', shareToken)
        .single();

      if (error || !entity) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      resolvedId = entity.id;
    }

    // ── Fetch page rows ────────────────────────────────────────────────────
    const { data: pages, error: pagesError } = await supabase
      .from(pagesTable)
      .select('page_number, file_path, label, indent, link_url, link_label')
      .eq(idColumn, resolvedId)
      .order('page_number', { ascending: true });

    if (pagesError) {
      console.error('page-urls: failed to fetch pages:', pagesError.message);
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    // ── Fallback signal: no rows yet (pre-backfill) ────────────────────────
    if (!pages || pages.length === 0) {
      return NextResponse.json({ pages: [], fallback: true });
    }

    // ── Generate signed URLs in parallel ──────────────────────────────────
    // All pages are in the same storage bucket ('proposals') regardless of
    // entity type — storage paths encode the type (proposals/ vs documents/).
    const cacheBuster = Date.now();

    const signedPages = await Promise.all(
      pages.map(async (page) => {
        const { data: signed } = await supabase.storage
          .from('proposals')
          .createSignedUrl(page.file_path, 3600);

        return {
          page_number: page.page_number,
          url:         signed?.signedUrl ? `${signed.signedUrl}&v=${cacheBuster}` : null,
          label:       page.label,
          indent:      page.indent,
          link_url:    page.link_url   ?? undefined,
          link_label:  page.link_label ?? undefined,
        };
      }),
    );

    // Filter out any pages where signing failed (log them but don't hard-fail)
    const failed = signedPages.filter((p) => !p.url);
    if (failed.length > 0) {
      console.error(
        `page-urls: failed to sign ${failed.length} page(s) for ${entityType} ${resolvedId}`,
        failed.map((p) => p.page_number),
      );
    }

    const validPages = signedPages.filter((p) => p.url);

    return NextResponse.json({ pages: validPages, fallback: false });
  } catch (err) {
    console.error('page-urls route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}