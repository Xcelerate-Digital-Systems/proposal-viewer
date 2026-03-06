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
          // Add proposal_date if field exists on proposal_pricing but not template_pricing
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
        const textPageInserts = templateTextPages
          .filter((tp) => tp.enabled)
          .map((tp) => {
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
          await supabase.from('proposal_text_pages').insert(textPageInserts);
          results.text_pages = textPageInserts.length;
        }
      }
    } catch (err) {
      console.error('Copy text pages error (non-fatal):', err);
    }

    // ── 3. Copy template_packages → proposal_packages ───────────────
    try {
      const { data: templatePackages } = await supabase
        .from('template_packages')
        .select('*')
        .eq('template_id', template_id)
        .order('sort_order', { ascending: true });

      if (templatePackages && templatePackages.length > 0) {
        const packagesInserts = templatePackages
          .filter((pkg) => pkg.enabled)
          .map((pkg) => {
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
          await supabase.from('proposal_packages').insert(packagesInserts);
          results.packages = true;
        }
      }
    } catch (err) {
      console.error('Copy packages error (non-fatal):', err);
    }

    return NextResponse.json({ success: true, copied: results });
  } catch (err) {
    console.error('Copy template data error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}