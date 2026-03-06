// app/api/templates/copy-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST — Copy template pricing, text pages, and packages to a new proposal.
 * Called after proposal record is created from a template.
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

    const now = new Date().toISOString();
    const results = { pricing: false, text_pages: 0, packages: false };

    // Maps from template entity IDs → new proposal entity IDs.
    // Used at the end to remap toc_settings.excluded_items, which is copied
    // from the template before this route runs (so it still contains template IDs).
    const textPageIdMap = new Map<string, string>();
    const packagesIdMap = new Map<string, string>();

    // ── 1. Copy template_pricing → proposal_pricing ─────────────────
    try {
      const { data: templatePricing } = await supabase
        .from('template_pricing')
        .select('*')
        .eq('template_id', template_id)
        .single();

      if (templatePricing && templatePricing.enabled) {
        const {
          id: _id, template_id: _tid, created_at: _ca, updated_at: _ua,
          ...pricingFields
        } = templatePricing;

        await supabase.from('proposal_pricing').insert({
          ...pricingFields,
          proposal_id,
          company_id,
          proposal_date: new Date().toISOString().split('T')[0],
          created_at: now,
          updated_at: now,
        });

        results.pricing = true;
      }
    } catch (err) {
      console.error('Copy pricing error (non-fatal):', err);
    }

    // ── 2. Copy template_text_pages → proposal_text_pages ───────────
    try {
      const { data: templateTextPages } = await supabase
        .from('template_text_pages')
        .select('*')
        .eq('template_id', template_id)
        .order('sort_order', { ascending: true });

      if (templateTextPages && templateTextPages.length > 0) {
        const enabledTextPages = templateTextPages.filter((tp) => tp.enabled);

        const textPageInserts = enabledTextPages.map((tp) => {
          const {
            id: _id, template_id: _tid, created_at: _ca, updated_at: _ua,
            ...pageFields
          } = tp;
          return {
            ...pageFields,
            proposal_id,
            company_id,
            created_at: now,
            updated_at: now,
          };
        });

        if (textPageInserts.length > 0) {
          // Use .select('id') so we can remap toc_settings.excluded_items below.
          // Supabase returns rows in insertion order, so index i → enabledTextPages[i].
          const { data: insertedTextPages } = await supabase
            .from('proposal_text_pages')
            .insert(textPageInserts)
            .select('id');

          results.text_pages = textPageInserts.length;

          if (insertedTextPages) {
            enabledTextPages.forEach((tp, i) => {
              if (insertedTextPages[i]) {
                textPageIdMap.set(tp.id, insertedTextPages[i].id);
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Copy text pages error (non-fatal):', err);
    }

    // ── 3. Copy template_packages → proposal_packages ───────────────
    // position and sort_order are preserved via ...packagesFields spread,
    // so package page placement carries over exactly from the template.
    try {
      const { data: templatePackages } = await supabase
        .from('template_packages')
        .select('*')
        .eq('template_id', template_id)
        .order('sort_order', { ascending: true });

      if (templatePackages && templatePackages.length > 0) {
        const enabledPackages = templatePackages.filter((pkg) => pkg.enabled);

        const packagesInserts = enabledPackages.map((pkg) => {
          const {
            id: _id, template_id: _tid, created_at: _ca, updated_at: _ua,
            ...packagesFields
          } = pkg;
          return {
            ...packagesFields,
            proposal_id,
            company_id,
            created_at: now,
            updated_at: now,
          };
        });

        if (packagesInserts.length > 0) {
          // Use .select('id') so we can remap toc_settings.excluded_items below.
          const { data: insertedPackages } = await supabase
            .from('proposal_packages')
            .insert(packagesInserts)
            .select('id');

          results.packages = true;

          if (insertedPackages) {
            enabledPackages.forEach((pkg, i) => {
              if (insertedPackages[i]) {
                packagesIdMap.set(pkg.id, insertedPackages[i].id);
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Copy packages error (non-fatal):', err);
    }

    // ── 4. Remap toc_settings.excluded_items ────────────────────────
    // toc_settings was written to the proposal from the template BEFORE this
    // route ran, so excluded_items still contains template-scoped IDs like
    // "text:template-uuid" and "packages:template-uuid". Remap them to the
    // new proposal IDs captured above.
    // "pdf:N", "pricing", and "group:name" identifiers are position-based /
    // static and do not need remapping.
    if (textPageIdMap.size > 0 || packagesIdMap.size > 0) {
      try {
        const { data: proposalRow } = await supabase
          .from('proposals')
          .select('toc_settings')
          .eq('id', proposal_id)
          .single();

        const toc = proposalRow?.toc_settings as Record<string, unknown> | null;

        if (toc && Array.isArray(toc.excluded_items) && toc.excluded_items.length > 0) {
          const remapped = (toc.excluded_items as string[]).map((item) => {
            if (item.startsWith('text:')) {
              const oldId = item.slice('text:'.length);
              const newId = textPageIdMap.get(oldId);
              return newId ? `text:${newId}` : item;
            }
            if (item.startsWith('packages:')) {
              const oldId = item.slice('packages:'.length);
              const newId = packagesIdMap.get(oldId);
              return newId ? `packages:${newId}` : item;
            }
            return item;
          });

          await supabase
            .from('proposals')
            .update({ toc_settings: { ...toc, excluded_items: remapped } })
            .eq('id', proposal_id);
        }
      } catch (err) {
        console.error('Remap toc excluded_items error (non-fatal):', err);
      }
    }

    // ── 5. Remap page_order ─────────────────────────────────────────
    // The template's page_order contains template-scoped package/text IDs.
    // Remap them to the new proposal IDs, then write to the proposal.
    try {
      const { data: tmplRow } = await supabase
        .from('proposal_templates')
        .select('page_order')
        .eq('id', template_id)
        .single();

      const rawOrder = tmplRow?.page_order;
      if (Array.isArray(rawOrder) && rawOrder.length > 0) {
        const remappedOrder = (rawOrder as Array<Record<string, unknown>>).map((entry) => {
          if (entry.type === 'packages' && typeof entry.id === 'string') {
            const newId = packagesIdMap.get(entry.id);
            return newId ? { type: 'packages', id: newId } : entry;
          }
          if (entry.type === 'text' && typeof entry.id === 'string') {
            const newId = textPageIdMap.get(entry.id);
            return newId ? { type: 'text', id: newId } : entry;
          }
          return entry;
        });

        await supabase
          .from('proposals')
          .update({ page_order: remappedOrder })
          .eq('id', proposal_id);
      }
    } catch (err) {
      console.error('Remap page_order error (non-fatal):', err);
    }

    return NextResponse.json({ success: true, copied: results });
  } catch (err) {
    console.error('Copy template data error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}