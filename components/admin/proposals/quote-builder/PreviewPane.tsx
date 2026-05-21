// components/admin/proposals/quote-builder/PreviewPane.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Eye } from 'lucide-react';
import { supabase, type Proposal, type ProposalPricing } from '@/lib/supabase';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import type { CompanyBranding } from '@/hooks/useProposal';
import QuoteSinglePageView from '@/components/viewer/QuoteSinglePageView';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

interface PreviewPaneProps {
  proposal: Proposal;
  companyId: string;
}

export default function PreviewPane({ proposal, companyId }: PreviewPaneProps) {
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [companyMeta, setCompanyMeta] = useState<{
    name: string;
    phone: string | null;
    email: string | null;
  }>({ name: '', phone: null, email: null });
  const [refreshing, setRefreshing] = useState(false);

  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      // Pricing — find the first 'pricing' page for this proposal in the
      // unified pages table. Reads via the public API route to honour the
      // same shape PricingTabEditor uses internally.
      const res = await fetch(`/api/proposals/pages?proposal_id=${proposal.id}`);
      if (res.ok) {
        const json = await res.json();
        // The unified pages API returns { pages: [...] }; pricing pages have
        // type='pricing' and store the rich payload directly on the row.
        const pages = (json.pages ?? json) as Array<Record<string, unknown>>;
        const pricingPage = pages.find((p) => p.type === 'pricing');
        if (pricingPage) {
          const payload = (pricingPage.payload ?? {}) as Record<string, unknown>;
          // Translate the unified-page row → ProposalPricing shape used by
          // QuoteSinglePageView. Fall back to sensible defaults for missing
          // fields so the preview never crashes on a half-built quote.
          setPricing({
            id: pricingPage.id as string,
            proposal_id: proposal.id,
            company_id: companyId,
            enabled: (pricingPage.enabled as boolean) ?? true,
            position: (pricingPage.position as number) ?? 0,
            title: (payload.title as string) ?? 'Project Investment',
            intro_text: (payload.intro_text as string) ?? null,
            items: (payload.items as ProposalPricing['items']) ?? [],
            optional_items: (payload.optional_items as ProposalPricing['optional_items']) ?? [],
            payment_schedule: (payload.payment_schedule as ProposalPricing['payment_schedule']) ?? null,
            tax_enabled: (payload.tax_enabled as boolean) ?? true,
            tax_rate: (payload.tax_rate as number) ?? 10,
            tax_label: (payload.tax_label as string) ?? 'GST (10%)',
            validity_days: (payload.validity_days as number) ?? 30,
            indent: (pricingPage.indent as number) ?? 0,
            proposal_date: (payload.proposal_date as string) ?? null,
            qty_enabled: (payload.qty_enabled as boolean) ?? false,
            footer_note: (payload.footer_note as string) ?? null,
            created_at: (pricingPage.created_at as string) ?? '',
            updated_at: (pricingPage.updated_at as string) ?? '',
          });
        } else {
          setPricing(null);
        }
      }

      // Company meta for cover header + fonts that the Design tab can set.
      const { data: company } = await supabase
        .from('companies')
        .select(
          'name, phone, contact_email, bg_primary, accent_color, font_heading, font_body, title_font_family',
        )
        .eq('id', companyId)
        .single();
      if (company) {
        setCompanyMeta({
          name: (company.name as string) ?? '',
          phone: (company.phone as string) ?? null,
          email: (company.contact_email as string) ?? null,
        });
        setBranding((prev) => ({
          ...prev,
          name: (company.name as string) ?? prev.name,
          bg_primary: (company.bg_primary as string) ?? prev.bg_primary,
          accent_color: (company.accent_color as string) ?? prev.accent_color,
          font_heading: (company.font_heading as string) ?? prev.font_heading,
          font_body: (company.font_body as string) ?? prev.font_body,
          title_font_family: (company.title_font_family as string) ?? prev.title_font_family,
        }));
      }
    } finally {
      setRefreshing(false);
    }
  }, [proposal.id, companyId]);

  useEffect(() => {
    refetch();
  }, [refetch, proposal.updated_at]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col sticky top-6 max-h-[calc(100vh-140px)]">
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Eye size={12} />
          Live Preview
        </div>
        <button
          type="button"
          onClick={refetch}
          disabled={refreshing}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Refresh preview"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ backgroundColor: proposal.quote_page_bg_color || '#eeece6' }}
      >
        <GoogleFontLoader
          fonts={[
            branding.font_heading,
            branding.font_body,
            branding.title_font_family,
            proposal.title_font_family,
            branding.font_button,
          ]}
        />
        <QuoteSinglePageView
          proposal={proposal}
          pricing={pricing}
          branding={branding}
          companyName={companyMeta.name}
          companyPhone={companyMeta.phone}
          companyEmail={companyMeta.email}
        />
      </div>
    </div>
  );
}
