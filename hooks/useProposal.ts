// hooks/useProposal.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  Proposal,
  ProposalComment,
  ProposalPricing,
  ProposalPackages,
  normalizePageNamesWithGroups,
  PageNameEntry,
  TocSettings,
  parseTocSettings,
  parsePageOrder,
  PageOrderEntry,
} from '@/lib/supabase';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { buildPageMap } from '@/lib/buildPageMap';

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

/**
 * Derive a border color by lightening the secondary bg.
 */
export function deriveBorderColor(bgSecondary: string): string {
  const hex = bgSecondary.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 22);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 22);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 22);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Derive a surface/card color between primary and secondary.
 */
export function deriveSurfaceColor(bgPrimary: string, bgSecondary: string): string {
  const p = bgPrimary.replace('#', '');
  const s = bgSecondary.replace('#', '');
  const r = Math.round((parseInt(p.slice(0, 2), 16) + parseInt(s.slice(0, 2), 16)) / 2 + 4);
  const g = Math.round((parseInt(p.slice(2, 4), 16) + parseInt(s.slice(2, 4), 16)) / 2 + 4);
  const b = Math.round((parseInt(p.slice(4, 6), 16) + parseInt(s.slice(4, 6), 16)) / 2 + 4);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

/* ─── Text page type ───────────────────────────────────────────────── */

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

/* ─── Per-page URL entry (returned by /api/proposals/page-urls) ─────── */

export interface PageUrlEntry {
  page_number: number;
  url: string;
  label: string;
  indent: number;
  link_url?: string | null;
  link_label?: string | null;
}

export function useProposal(token: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // Legacy single signed URL — populated only when per-page rows don't exist yet (fallback)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // Per-page signed URLs — primary path post-migration
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageNamesRaw, setPageNamesRaw] = useState<unknown>(null);
  const [pageOrder, setPageOrder] = useState<PageOrderEntry[] | null>(null);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
  const [packages, setPackages] = useState<ProposalPackages[]>([]);
  const [textPages, setTextPages] = useState<ProposalTextPage[]>([]);
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
    setPageNamesRaw(data.page_names);
    setPageOrder(parsePageOrder(data.page_order));
    if (data.status === 'accepted') setAccepted(true);

    // Fetch company branding
    try {
      const brandingRes = await fetch(`/api/company/branding?company_id=${data.company_id}`);
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();

        // Entity-level bg image override (proposal → company fallback)
        if (data.bg_image_path) {
          const { data: bgUrlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.bg_image_path);
          if (bgUrlData?.publicUrl) {
            brandingData.bg_image_url = bgUrlData.publicUrl;
          }
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
    } catch {
      // Non-critical
    }
    setBrandingLoaded(true);

    // Fetch pricing, packages, text pages in parallel
    const [pricingRes, packagesRes, textRes] = await Promise.all([
      fetch(`/api/proposals/pricing?share_token=${token}`).catch(() => null),
      fetch(`/api/proposals/packages?share_token=${token}`).catch(() => null),
      fetch(`/api/proposals/text-pages?share_token=${token}`).catch(() => null),
    ]);

    if (pricingRes?.ok) {
      try {
        const pricingData = await pricingRes.json();
        if (pricingData && pricingData.enabled) setPricing(pricingData);
      } catch { /* Non-critical */ }
    }

    if (packagesRes?.ok) {
      try {
        const packagesData = await packagesRes.json();
        if (Array.isArray(packagesData)) {
          setPackages(packagesData.filter((p: ProposalPackages) => p.enabled));
        }
      } catch { /* Non-critical */ }
    }

    if (textRes?.ok) {
      try {
        const textData: ProposalTextPage[] = await textRes.json();
        setTextPages(textData.filter((tp) => tp.enabled));
      } catch { /* Non-critical */ }
    }

    // Check if the viewer is a logged-in team member
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
        notify({ event_type: 'proposal_viewed', share_token: token });
      }
    }

    // ── Per-page URL fetch (primary path) ──────────────────────────────
    try {
      const pageUrlRes = await fetch(`/api/proposals/page-urls?share_token=${token}`);
      if (pageUrlRes.ok) {
        const pageUrlData = await pageUrlRes.json();

        if (pageUrlData.fallback) {
          // Pre-backfill: no proposal_pages rows yet — fall back to legacy merged PDF
          if (data.file_path) {
            const { data: signedData } = await supabase.storage
              .from('proposals')
              .createSignedUrl(data.file_path, 3600);
            if (signedData?.signedUrl) {
              setPdfUrl(signedData.signedUrl + '&v=' + Date.now());
            }
          }
        } else {
          // Per-page path: set URLs and derive page count immediately
          const pages: PageUrlEntry[] = pageUrlData.pages ?? [];
          setPageUrls(pages);
          setPdfPageCount(pages.length);
          // Keep pdfUrl null — PdfViewer will be updated to consume pageUrls directly
        }
      } else {
        // API error — fall back to legacy signed URL
        if (data.file_path) {
          const { data: signedData } = await supabase.storage
            .from('proposals')
            .createSignedUrl(data.file_path, 3600);
          if (signedData?.signedUrl) {
            setPdfUrl(signedData.signedUrl + '&v=' + Date.now());
          }
        }
      }
    } catch {
      // Network error — fall back to legacy signed URL
      if (data.file_path) {
        const { data: signedData } = await supabase.storage
          .from('proposals')
          .createSignedUrl(data.file_path, 3600);
        if (signedData?.signedUrl) {
          setPdfUrl(signedData.signedUrl + '&v=' + Date.now());
        }
      }
    }

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

  // Build a lookup map from per-page data for label/indent/link overlay
  const pageUrlMap = useMemo<Map<number, PageUrlEntry>>(() => {
    const map = new Map<number, PageUrlEntry>();
    for (const p of pageUrls) map.set(p.page_number, p);
    return map;
  }, [pageUrls]);

  // Normalize page names — groups come from page_names JSONB; labels/indents/links
  // are overlaid from proposal_pages rows (via pageUrlMap) when available.
  const pageEntries: PageNameEntry[] = useMemo(() => {
    if (!pageNamesRaw && pageUrls.length === 0) return [];

    if (pageUrls.length > 0) {
      // Per-page path: use pageUrls as source of truth for labels/indents/links,
      // but preserve group (section header) entries from page_names JSONB.
      const normalized = normalizePageNamesWithGroups(pageNamesRaw, pdfPageCount);
      let pdfIdx = 0;
      return normalized.map((entry) => {
        if (entry.type === 'group') return entry;
        pdfIdx++;
        const pageData = pageUrlMap.get(pdfIdx);
        return {
          name: pageData?.label || entry.name || `Page ${pdfIdx}`,
          indent: pageData?.indent ?? entry.indent ?? 0,
          ...(pageData?.link_url ? { link_url: pageData.link_url } : {}),
          ...(pageData?.link_label ? { link_label: pageData.link_label } : {}),
        };
      });
    }

    // Fallback path: legacy page_names only
    return normalizePageNamesWithGroups(pageNamesRaw, pdfPageCount);
  }, [pageNamesRaw, pdfPageCount, pageUrls, pageUrlMap]);

  // Parse TOC settings
  const tocSettings = proposal ? parseTocSettings(proposal.toc_settings) : null;

  // Build virtual page map
  const pageMap = useMemo(
    () => buildPageMap(pdfPageCount, pricing, textPages, packages, tocSettings, pageOrder),
    [pdfPageCount, pricing, textPages, packages, tocSettings, pageOrder]
  );

  // Build page entries with special pages inserted for sidebar.
  // Groups (section headers) are preserved at their original positions relative to PDF pages.
  const allPageEntries = useMemo(() => {
    if (pdfPageCount === 0) return pageEntries;

    // Separate groups from real page entries, tracking group positions
    const pdfEntries: PageNameEntry[] = [];
    const groupsBefore: Map<number, PageNameEntry[]> = new Map();
    let pendingGroups: PageNameEntry[] = [];

    for (const entry of pageEntries) {
      if (entry.type === 'group') {
        pendingGroups.push(entry);
      } else {
        if (pendingGroups.length > 0) {
          groupsBefore.set(pdfEntries.length, [...pendingGroups]);
          pendingGroups = [];
        }
        pdfEntries.push(entry);
      }
    }
    const trailingGroups = pendingGroups;

    if (!pageMap.pageSequence || pageMap.pageSequence.length === 0) {
      return pageEntries;
    }

    const result: PageNameEntry[] = [];
    for (const seqEntry of pageMap.pageSequence) {
      if (seqEntry.type === 'pdf') {
        const pdfIndex = seqEntry.pdfPage - 1;
        const groups = groupsBefore.get(pdfIndex);
        if (groups) result.push(...groups);
        result.push(pdfEntries[pdfIndex] || { name: `Page ${seqEntry.pdfPage}`, indent: 0 });
      } else if (seqEntry.type === 'pricing') {
        result.push({
          name: pricing?.title || 'Your Investment',
          indent: pricing?.indent ?? 0,
          link_url: (pricing as Record<string, unknown>)?.link_url as string | undefined,
          link_label: (pricing as Record<string, unknown>)?.link_label as string | undefined,
        });
      } else if (seqEntry.type === 'packages') {
        const pkg = packages.find(
          (p) => p.id === (seqEntry as { type: 'packages'; packagesId: string }).packagesId
        );
        result.push({
          name: pkg?.title || 'Packages',
          indent: pkg?.indent ?? 0,
        });
      } else if (seqEntry.type === 'toc') {
        result.push({
          name: tocSettings?.title || 'Table of Contents',
          indent: 0,
        });
      } else {
        const tp = textPages.find((t) => t.id === seqEntry.textPageId);
        result.push({
          name: tp?.title || 'Text Page',
          indent: tp?.indent ?? 0,
          link_url: tp?.link_url ?? undefined,
          link_label: tp?.link_label ?? undefined,
        });
      }
    }

    result.push(...trailingGroups);

    return result;
  }, [pageEntries, pdfPageCount, pricing, packages, textPages, tocSettings, pageMap.pageSequence]);

  // onDocumentLoadSuccess: still used in fallback mode where PdfViewer loads the
  // merged PDF. In per-page mode (pageUrls.length > 0) the count is already set
  // from pageUrls.length, but this is harmless to keep for compatibility.
  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    if (pageUrls.length === 0) {
      // Only update from PDF load in legacy fallback mode
      setPdfPageCount(n);
    }
  }, [pageUrls.length]);

  const getPageName = (pageNum: number) => {
    return allPageEntries[pageNum - 1]?.name || `Page ${pageNum}`;
  };

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
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_name: name,
      })
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
    notify({
      event_type: 'comment_added',
      share_token: token,
      comment_id: newComment?.id,
      comment_author: authorName,
      comment_content: content,
      author_type: authorType,
    });
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
    notify({
      event_type: 'comment_added',
      share_token: token,
      comment_id: newReply?.id,
      comment_author: authorName,
      comment_content: content,
      author_type: authorType,
    });
  };

  const resolveComment = async (commentId: string, resolvedBy: string) => {
    const authorType = isTeamPreview ? 'team' : 'client';
    await supabase
      .from('proposal_comments')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', commentId);
    await refreshComments();
    notify({
      event_type: 'comment_resolved',
      share_token: token,
      comment_id: commentId,
      resolved_by: resolvedBy,
      author_type: authorType,
    });
  };

  const unresolveComment = async (commentId: string) => {
    await supabase
      .from('proposal_comments')
      .update({
        resolved_at: null,
        resolved_by: null,
      })
      .eq('id', commentId);
    await refreshComments();
  };

  const getTextPage = useCallback(
    (textPageId: string): ProposalTextPage | undefined => {
      return textPages.find((tp) => tp.id === textPageId);
    },
    [textPages]
  );

  return {
    proposal,
    creatorName: proposal?.created_by_name || null,
    // pdfUrl: populated in legacy fallback mode only; null when per-page is active
    pdfUrl,
    // pageUrls: populated when proposal_pages rows exist (primary path)
    pageUrls,
    numPages: pageMap.totalPages,
    pdfPageCount,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries: allPageEntries,
    comments,
    accepted,
    branding,
    brandingLoaded,
    pricing,
    packages,
    textPages,
    isPricingPage: pageMap.isPricingPage,
    isPackagesPage: pageMap.isPackagesPage,
    getPackagesId: pageMap.getPackagesId,
    isTocPage: pageMap.isTocPage,
    isTextPage: pageMap.isTextPage,
    tocSettings,
    pageSequence: pageMap.pageSequence,
    getTextPageId: pageMap.getTextPageId,
    toPdfPage: pageMap.toPdfPage,
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