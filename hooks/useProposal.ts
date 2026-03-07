// hooks/useProposal.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  Proposal,
  ProposalComment,
  TocSettings,
  parseTocSettings,
  PageNameEntry,
} from '@/lib/supabase';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

// Fire-and-forget notification — doesn't block UI
function notify(payload: Record<string, string | undefined>) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export type CompanyBranding = {
  name: string;
  logo_url: string | null;
  accent_color: string;
  website: string | null;
  bg_primary: string;
  bg_secondary: string;
  sidebar_text_color: string;
  accept_text_color: string;
  cover_bg_style: 'gradient' | 'solid';
  cover_bg_color_1: string;
  cover_bg_color_2: string;
  cover_text_color: string;
  cover_subtitle_color: string;
  cover_button_bg: string;
  cover_button_text: string;
  cover_overlay_opacity: number;
  cover_gradient_type: 'linear' | 'radial' | 'conic';
  cover_gradient_angle: number;
  font_heading: string | null;
  font_body: string | null;
  font_sidebar: string | null;
  font_heading_weight: string | null;
  font_body_weight: string | null;
  font_sidebar_weight: string | null;
  text_page_bg_color: string;
  title_font_family: string | null;
  title_font_weight: string | null;
  title_font_size: string | null;
  text_page_text_color: string;
  text_page_heading_color: string | null;
  text_page_font_size: string;
  text_page_border_enabled: boolean;
  text_page_border_color: string | null;
  text_page_border_radius: string;
  text_page_layout: 'contained' | 'full';
  bg_image_url: string | null;
  bg_image_overlay_opacity: number;
  page_num_circle_color: string | null;
  page_num_text_color: string | null;
};

export function deriveBorderColor(bgSecondary: string): string {
  const hex = bgSecondary.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 22);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 22);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 22);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function deriveSurfaceColor(bgPrimary: string, bgSecondary: string): string {
  const p = bgPrimary.replace('#', '');
  const s = bgSecondary.replace('#', '');
  const r = Math.round((parseInt(p.slice(0, 2), 16) + parseInt(s.slice(0, 2), 16)) / 2 + 4);
  const g = Math.round((parseInt(p.slice(2, 4), 16) + parseInt(s.slice(2, 4), 16)) / 2 + 4);
  const b = Math.round((parseInt(p.slice(4, 6), 16) + parseInt(s.slice(4, 6), 16)) / 2 + 4);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

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
  prepared_by_member_id?: string | null;
  show_title?: boolean;
}

/**
 * Unified page entry returned by /api/proposals/page-urls.
 * Covers all page types — PDF pages have a signed `url`.
 */
export interface PageUrlEntry {
  id:          string;
  position:    number;
  type:        'pdf' | 'text' | 'pricing' | 'packages' | 'toc' | 'section';
  url:         string | null;
  title:       string;
  indent:      number;
  link_url?:   string;
  link_label?: string;
  payload:     Record<string, unknown>;
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

      if (isFirstView) notify({ event_type: 'proposal_viewed', share_token: token });
    }

    // Fetch all pages (unified v2 — all types, signed URLs included)
    try {
      const pageUrlRes = await fetch(`/api/proposals/page-urls?share_token=${token}`);
      if (pageUrlRes.ok) {
        const pageUrlData = await pageUrlRes.json();
        const pages: PageUrlEntry[] = pageUrlData.pages ?? [];
        setPageUrls(pages);
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

  /* ── Derived state from unified page list ──────────────────────────────── */

  // Sidebar nav entries — section pages become 'group' type
  const pageEntries: PageNameEntry[] = useMemo(
    () =>
      pageUrls.map((p) => ({
        name: p.title,
        indent: p.indent,
        ...(p.type === 'section' ? { type: 'group' as const } : {}),
        ...(p.link_url ? { link_url: p.link_url } : {}),
        ...(p.link_label ? { link_label: p.link_label } : {}),
      })),
    [pageUrls],
  );

  const numPages = pageUrls.length;

  // Virtual page type helpers
  const isPricingPage  = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'pricing',  [pageUrls]);
  const isPackagesPage = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'packages', [pageUrls]);
  const isTocPage      = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'toc',      [pageUrls]);
  const isTextPage     = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'text',     [pageUrls]);

  const getPackagesId = useCallback(
    (vp: number): string | null => pageUrls[vp - 1]?.type === 'packages' ? pageUrls[vp - 1].id : null,
    [pageUrls],
  );
  const getTextPageId = useCallback(
    (vp: number): string | null => pageUrls[vp - 1]?.type === 'text' ? pageUrls[vp - 1].id : null,
    [pageUrls],
  );
  const toPdfPage = useCallback(
    (vp: number): number => {
      // Count how many PDF pages precede this virtual page
      let pdfCount = 0;
      for (let i = 0; i < vp - 1 && i < pageUrls.length; i++) {
        if (pageUrls[i].type === 'pdf') pdfCount++;
      }
      return pageUrls[vp - 1]?.type === 'pdf' ? pdfCount + 1 : -1;
    },
    [pageUrls],
  );

  // Virtual page sequence (for viewer components that expect it)
  const pageSequence = useMemo(
    () =>
      pageUrls.map((p) => {
        if (p.type === 'pdf') {
          // Count PDF pages up to this one for pdfPage index
          const pdfIndex = pageUrls.slice(0, pageUrls.indexOf(p) + 1).filter((x) => x.type === 'pdf').length;
          return { type: 'pdf' as const, pdfPage: pdfIndex };
        }
        if (p.type === 'text') return { type: 'text' as const, textPageId: p.id };
        if (p.type === 'pricing') return { type: 'pricing' as const };
        if (p.type === 'packages') return { type: 'packages' as const, packagesId: p.id };
        if (p.type === 'toc') return { type: 'toc' as const };
        return { type: 'pdf' as const, pdfPage: 0 }; // section — shouldn't reach viewer
      }),
    [pageUrls],
  );

  // Backward-compat: extract pricing/packages/textPages from payloads for viewer components
  const pricing = useMemo(() => {
    const p = pageUrls.find((x) => x.type === 'pricing');
    if (!p) return null;
    return { id: p.id, enabled: true, ...p.payload } as Record<string, unknown>;
  }, [pageUrls]);

  const packages = useMemo(
    () =>
      pageUrls
        .filter((x) => x.type === 'packages')
        .map((p) => ({ id: p.id, enabled: true, title: p.title, indent: p.indent, ...p.payload })),
    [pageUrls],
  );

  const textPages: ProposalTextPage[] = useMemo(
    () =>
      pageUrls
        .filter((x) => x.type === 'text')
        .map((p) => ({
          id: p.id,
          proposal_id: proposal?.id ?? '',
          company_id: proposal?.company_id ?? '',
          enabled: true,
          position: p.position,
          title: p.title,
          content: p.payload.content ?? null,
          sort_order: p.position,
          indent: p.indent,
          link_url: p.link_url ?? null,
          link_label: p.link_label ?? null,
        })),
    [pageUrls, proposal],
  );

  const tocSettings = proposal ? parseTocSettings(proposal.toc_settings) : null;

  // pdfPageCount = number of PDF pages in the sequence
  const pdfPageCount = useMemo(() => pageUrls.filter((p) => p.type === 'pdf').length, [pageUrls]);

  const getPageName = (pageNum: number) => pageEntries[pageNum - 1]?.name || `Page ${pageNum}`;

  const getTextPage = useCallback(
    (textPageId: string): ProposalTextPage | undefined => textPages.find((tp) => tp.id === textPageId),
    [textPages],
  );

  const refreshComments = async () => {
    if (!proposal) return;
    const { data } = await supabase
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', proposal.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const acceptProposal = async (name: string) => {
    if (!proposal) return;
    await supabase
      .from('proposals')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_name: name })
      .eq('id', proposal.id);
    setAccepted(true);
    notify({ event_type: 'proposal_accepted', share_token: token });
  };

  const submitComment = async (authorName: string, content: string, pageNumber: number) => {
    if (!proposal) return;
    const authorType = isTeamPreview ? 'team' : 'client';
    const { data: newComment } = await supabase
      .from('proposal_comments')
      .insert({
        proposal_id: proposal.id,
        author_name: authorName,
        author_type: authorType,
        content,
        page_number: pageNumber,
        is_internal: false,
        company_id: proposal.company_id,
      })
      .select('id')
      .single();
    await refreshComments();
    notify({ event_type: 'comment_added', share_token: token, comment_id: newComment?.id, comment_author: authorName, comment_content: content, author_type: authorType });
  };

  const replyToComment = async (parentId: string, authorName: string, content: string) => {
    if (!proposal) return;
    const authorType = isTeamPreview ? 'team' : 'client';
    const parent = comments.find((c) => c.id === parentId);
    const { data: newReply } = await supabase
      .from('proposal_comments')
      .insert({
        proposal_id: proposal.id,
        author_name: authorName,
        author_type: authorType,
        content,
        page_number: parent?.page_number || null,
        is_internal: false,
        parent_id: parentId,
        company_id: proposal.company_id,
      })
      .select('id')
      .single();
    await refreshComments();
    notify({ event_type: 'comment_added', share_token: token, comment_id: newReply?.id, comment_author: authorName, comment_content: content, author_type: authorType });
  };

  const resolveComment = async (commentId: string, resolvedBy: string) => {
    const authorType = isTeamPreview ? 'team' : 'client';
    await supabase
      .from('proposal_comments')
      .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
      .eq('id', commentId);
    await refreshComments();
    notify({ event_type: 'comment_resolved', share_token: token, comment_id: commentId, resolved_by: resolvedBy, author_type: authorType });
  };

  const unresolveComment = async (commentId: string) => {
    await supabase
      .from('proposal_comments')
      .update({ resolved_at: null, resolved_by: null })
      .eq('id', commentId);
    await refreshComments();
  };

  const onDocumentLoadSuccess = useCallback((_: { numPages: number }) => {
    // No-op in v2: page count comes from pageUrls.length, not PDF metadata
  }, []);

  return {
    proposal,
    creatorName: proposal?.created_by_name || null,
    pdfUrl: null, // v2: per-page URLs only
    pageUrls,
    numPages,
    pdfPageCount,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    comments,
    accepted,
    branding,
    brandingLoaded,
    pricing,
    packages,
    textPages,
    isPricingPage,
    isPackagesPage,
    getPackagesId,
    isTocPage,
    isTextPage,
    tocSettings,
    pageSequence,
    getTextPageId,
    toPdfPage,
    getTextPage,
    onDocumentLoadSuccess,
    getPageName,
    acceptProposal,
    submitComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  };
}

export { DEFAULT_BRANDING } from '@/lib/branding-defaults';