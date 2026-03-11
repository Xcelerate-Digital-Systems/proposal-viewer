// hooks/useProposal.ts
'use client';

// Re-export so existing `import { CompanyBranding } from '@/hooks/useProposal'` keeps working
export type { CompanyBranding } from '@/lib/types/branding';
export { deriveBorderColor, deriveSurfaceColor } from '@/lib/types/branding';
import { useState, useEffect, useCallback } from 'react';
import { supabase, Proposal, ProposalComment } from '@/lib/supabase';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import type { CompanyBranding } from '@/lib/types/branding';
import { useProposalDerived } from './useProposalDerived';
import { createProposalActions } from './useProposalActions';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface ProposalTextPage {
  id: string;
  proposal_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  title: string;
  content: unknown;
  sort_order: number;
  indent: number;
  link_url?: string | null;
  link_label?: string | null;
  show_member_badge?: boolean;
  show_client_logo: boolean;
  prepared_by_member_id?: string | null;
  show_title?: boolean;
}

export interface PageUrlEntry {
  id:                    string;
  position:              number;
  type:                  'pdf' | 'text' | 'pricing' | 'packages' | 'toc' | 'section';
  url:                   string | null;
  title:                 string;
  indent:                number;
  link_url?:             string;
  link_label?:           string;
  show_title:            boolean;
  show_member_badge:     boolean;
  show_client_logo:      boolean;
  prepared_by_member_id: string | null;
  payload:               Record<string, unknown>;
}

/* ─── Hook ─────────────────────────────────────────────────────────────────── */

export function useProposal(token: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [revisionRequested, setRevisionRequested] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [isTeamPreview, setIsTeamPreview] = useState(false);

  const fetchProposal = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProposal(data);
    if (data.status === 'accepted') setAccepted(true);
    if (data.status === 'declined') setDeclined(true);
    if (data.status === 'revision_requested') setRevisionRequested(true);

    // Fetch company branding
    try {
      const brandingRes = await fetch(`/api/company/branding?company_id=${data.company_id}`);
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();

        if (data.bg_image_path) {
          const { data: bgUrlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.bg_image_path);
          if (bgUrlData?.publicUrl) brandingData.bg_image_url = bgUrlData.publicUrl;
          brandingData.bg_image_overlay_opacity =
            data.bg_image_overlay_opacity ?? brandingData.bg_image_overlay_opacity ?? 0.85;
          brandingData.bg_image_blur = data.bg_image_blur ?? 0;
        }

        if (data.text_page_bg_color != null) brandingData.text_page_bg_color = data.text_page_bg_color;
        if (data.text_page_text_color != null) brandingData.text_page_text_color = data.text_page_text_color;
        if (data.text_page_heading_color != null) brandingData.text_page_heading_color = data.text_page_heading_color;
        if (data.text_page_font_size != null) brandingData.text_page_font_size = data.text_page_font_size;
        if (data.text_page_border_enabled != null) brandingData.text_page_border_enabled = data.text_page_border_enabled;
        if (data.text_page_border_color != null) brandingData.text_page_border_color = data.text_page_border_color;
        if (data.text_page_border_radius != null) brandingData.text_page_border_radius = data.text_page_border_radius;
        if (data.text_page_layout != null) brandingData.text_page_layout = data.text_page_layout;
        if (data.title_font_family != null) brandingData.title_font_family = data.title_font_family;
        if (data.title_font_weight != null) brandingData.title_font_weight = data.title_font_weight;
        if (data.title_font_size != null) brandingData.title_font_size = data.title_font_size;
        if (data.page_num_circle_color != null) brandingData.page_num_circle_color = data.page_num_circle_color;
        if (data.page_num_text_color != null) brandingData.page_num_text_color = data.page_num_text_color;

        setBranding(brandingData);
      }
    } catch { /* Non-critical */ }
    setBrandingLoaded(true);

    // Check if viewer is a logged-in team member
    let teamPreview = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) teamPreview = true;
    } catch { /* No session */ }
    setIsTeamPreview(teamPreview);

    // Only track views for actual client views
    if (!teamPreview) {
      const isFirstView = !data.first_viewed_at;
      const now = new Date().toISOString();
      const updates: Record<string, string> = { last_viewed_at: now };
      if (isFirstView) updates.first_viewed_at = now;
      if (data.status === 'sent') updates.status = 'viewed';

      await supabase.from('proposals').update(updates).eq('id', data.id);
      await supabase.from('proposal_views').insert({
        proposal_id: data.id,
        user_agent: navigator.userAgent,
        company_id: data.company_id,
      });

      if (isFirstView) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'proposal_viewed', share_token: token }),
        }).catch(() => {});
      }
    }

    // Fetch all pages (unified v2)
    try {
      const pageUrlRes = await fetch(`/api/proposals/page-urls?share_token=${token}`, { cache: 'no-store' });
      if (pageUrlRes.ok) {
        const pageUrlData = await pageUrlRes.json();
        setPageUrls(pageUrlData.pages ?? []);
      }
    } catch { /* Non-critical */ }

    // Fetch comments
    const { data: commentsData } = await supabase
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', data.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    setComments(commentsData || []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // Derived page state
  const derived = useProposalDerived(pageUrls, proposal);

  // Action handlers
  const actions = createProposalActions({
    proposal, token, comments, isTeamPreview,
    setAccepted, setDeclined, setRevisionRequested, setComments,
  });

  return {
    proposal,
    creatorName: proposal?.created_by_name || null,
    pdfUrl: null,
    pageUrls,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    comments,
    accepted,
    declined,
    revisionRequested,
    branding,
    brandingLoaded,
    ...derived,
    ...actions,
  };
}

export { DEFAULT_BRANDING } from '@/lib/branding-defaults';
