// hooks/useProposalById.ts
// Admin-side hook: fetches proposal + pages + branding by proposal ID (authenticated).
// Used by InlinePreviewEditor. Does NOT track views or use share tokens.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, type Proposal } from '@/lib/supabase';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import type { CompanyBranding } from '@/lib/types/branding';
import type { PageUrlEntry } from '@/hooks/useProposal';

export interface ProposalByIdState {
  proposal: Proposal | null;
  pages: PageUrlEntry[];
  branding: CompanyBranding;
  loading: boolean;
  reload: () => void;
}

export function useProposalById(proposalId: string): ProposalByIdState {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pages, setPages] = useState<PageUrlEntry[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);

    // Fetch proposal record
    const { data: proposalData, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (error || !proposalData) {
      setLoading(false);
      return;
    }

    setProposal(proposalData);

    // Fetch branding
    try {
      const res = await window.fetch(`/api/company/branding?company_id=${proposalData.company_id}`);
      if (res.ok) {
        const brandingData = await res.json();
        // Merge proposal-level overrides (same logic as useProposal)
        if (proposalData.text_page_bg_color != null)      brandingData.text_page_bg_color      = proposalData.text_page_bg_color;
        if (proposalData.text_page_text_color != null)    brandingData.text_page_text_color    = proposalData.text_page_text_color;
        if (proposalData.text_page_heading_color != null) brandingData.text_page_heading_color = proposalData.text_page_heading_color;
        if (proposalData.text_page_font_size != null)     brandingData.text_page_font_size     = proposalData.text_page_font_size;
        if (proposalData.title_font_family != null)       brandingData.title_font_family       = proposalData.title_font_family;
        if (proposalData.title_font_weight != null)       brandingData.title_font_weight       = proposalData.title_font_weight;
        if (proposalData.title_font_size != null)         brandingData.title_font_size         = proposalData.title_font_size;
        setBranding(brandingData);
      }
    } catch { /* Non-critical */ }

    // Fetch pages via page-urls API (returns payload + signed URLs for PDFs)
    try {
      const pagesRes = await window.fetch(
        `/api/proposals/page-urls?entity_id=${proposalId}`,
        { cache: 'no-store' },
      );
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages ?? []);
      }
    } catch { /* Non-critical */ }

    setLoading(false);
  }, [proposalId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { proposal, pages, branding, loading, reload: fetch };
}
