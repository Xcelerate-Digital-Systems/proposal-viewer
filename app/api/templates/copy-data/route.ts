// app/api/templates/copy-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

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
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { template_id, proposal_id } = body;

    if (!template_id || !proposal_id) {
      return NextResponse.json(
        { error: 'template_id and proposal_id are required' },
        { status: 400 }
      );
    }

    // company_id is always derived from the authenticated session and used to
    // verify both the template and proposal belong to the caller.
    const company_id = auth.companyId;

    const [{ data: tmpl }, { data: prop }] = await Promise.all([
      supabase.from('proposal_templates').select('id').eq('id', template_id).eq('company_id', company_id).maybeSingle(),
      supabase.from('proposals').select('id').eq('id', proposal_id).eq('company_id', company_id).maybeSingle(),
    ]);
    if (!tmpl || !prop) {
      return NextResponse.json({ error: 'Template or proposal not found' }, { status: 404 });
    }

    // ── 1. Fetch all non-pdf rows from template ──────────────────────────────
    const { data: templatePages, error: fetchError } = await supabase
      .from('template_pages_v2')
      .select('*')
      .eq('template_id', template_id)
      .neq('type', 'pdf')
      .order('position', { ascending: true });

    if (fetchError) {
      console.error('[api/templates/copy-data] POST fetch:', fetchError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!templatePages || templatePages.length === 0) {
      return NextResponse.json({ success: true, copied: 0 });
    }

    // ── 2. Find occupied positions so we can avoid conflicts ────────────────
    const { data: existingPages } = await supabase
      .from('proposal_pages_v2')
      .select('position')
      .eq('proposal_id', proposal_id);

    const occupied = new Set((existingPages || []).map((p: { position: number }) => p.position));

    // Remap non-PDF pages to the next free position if their original
    // template position conflicts with an already-inserted PDF row.
    let nextFree = Math.max(0, ...Array.from(occupied), ...templatePages.map((tp) => tp.position)) + 1;
    const toInsert = templatePages.map((tp) => {
      let pos = tp.position;
      if (occupied.has(pos)) {
        while (occupied.has(nextFree)) nextFree++;
        pos = nextFree;
        nextFree++;
      }
      occupied.add(pos);
      return {
        proposal_id,
        company_id,
        position:          pos,
        type:              tp.type,
        title:             tp.title,
        indent:            tp.indent ?? 0,
        enabled:           tp.enabled ?? true,
        link_url:          tp.link_url   ?? null,
        link_label:        tp.link_label ?? null,
        orientation:       tp.orientation ?? 'auto',
        show_title:        tp.show_title        ?? true,
        show_member_badge: tp.show_member_badge  ?? false,
        show_client_logo:  tp.show_client_logo   ?? false,
        payload:           tp.payload ?? {},
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from('proposal_pages_v2')
      .insert(toInsert)
      .select('id, type');

    if (insertError) {
      console.error('[api/templates/copy-data] POST insert:', insertError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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