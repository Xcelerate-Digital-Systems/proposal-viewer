// app/api/templates/copy-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST — Copy all non-pdf page rows from a template to a new proposal.
 * Called after the proposal record is created and its PDF pages are split.
 *
 * This copies toc, text, pricing, packages, and section rows from
 * template_pages_v2 → proposal_pages_v2, preserving their positions so they
 * slot correctly between the pdf rows inserted by split-proposal-pages.
 *
 * Body: { template_id: string, proposal_id: string, company_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { template_id, proposal_id, company_id } = await req.json();

    if (!template_id || !proposal_id || !company_id) {
      return NextResponse.json(
        { error: 'template_id, proposal_id, and company_id are required' },
        { status: 400 }
      );
    }

    // ── 1. Fetch all non-pdf rows from template ──────────────────────────────
    const { data: templatePages, error: fetchError } = await supabase
      .from('template_pages_v2')
      .select('*')
      .eq('template_id', template_id)
      .neq('type', 'pdf')
      .order('position', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!templatePages || templatePages.length === 0) {
      return NextResponse.json({ success: true, copied: 0 });
    }

    // ── 2. Insert into proposal_pages_v2 ────────────────────────────────────
    const toInsert = templatePages.map((tp) => ({
      proposal_id,
      company_id,
      position:          tp.position,
      type:              tp.type,
      title:             tp.title,
      indent:            tp.indent ?? 0,
      enabled:           tp.enabled ?? true,
      link_url:          tp.link_url   ?? null,
      link_label:        tp.link_label ?? null,
      orientation:       tp.orientation ?? 'auto',
      show_title:        tp.show_title       ?? true,
      show_member_badge: tp.show_member_badge ?? false,
      payload:           tp.payload ?? {},
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('proposal_pages_v2')
      .insert(toInsert)
      .select('id, type');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // ── 3. Build ID map: old template _v2 row ID → new proposal _v2 row ID ──
    // Needed to remap toc_settings.excluded_items which was copied from the
    // template before this route ran (so it still contains template row IDs).
    const idMap = new Map<string, string>();
    if (inserted) {
      templatePages.forEach((tp, i) => {
        if (inserted[i]) idMap.set(tp.id, inserted[i].id);
      });
    }

    // ── 4. Remap toc_settings.excluded_items ────────────────────────────────
    // excluded_items contains entries like 'packages:{uuid}' and 'text:{uuid}'
    // where the uuid is the template_pages_v2 row ID. Remap to the new
    // proposal_pages_v2 row IDs. 'pdf:N', 'pricing', and 'group:...' are
    // position-based / static and don't need remapping.
    if (idMap.size > 0) {
      try {
        const { data: proposalRow } = await supabase
          .from('proposals')
          .select('toc_settings')
          .eq('id', proposal_id)
          .single();

        const toc = proposalRow?.toc_settings as Record<string, unknown> | null;

        if (toc && Array.isArray(toc.excluded_items) && toc.excluded_items.length > 0) {
          const remapped = (toc.excluded_items as string[]).map((item) => {
            if (item.startsWith('packages:')) {
              const newId = idMap.get(item.slice('packages:'.length));
              return newId ? `packages:${newId}` : item;
            }
            if (item.startsWith('text:')) {
              const newId = idMap.get(item.slice('text:'.length));
              return newId ? `text:${newId}` : item;
            }
            return item;
          });

          await supabase
            .from('proposals')
            .update({ toc_settings: { ...toc, excluded_items: remapped } })
            .eq('id', proposal_id);
        }
      } catch (err) {
        console.error('Remap toc_settings error (non-fatal):', err);
      }
    }

    return NextResponse.json({ success: true, copied: toInsert.length });
  } catch (err) {
    console.error('Copy template data error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}