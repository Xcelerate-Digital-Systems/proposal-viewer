// hooks/useProposal.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Proposal, ProposalComment, ProposalPricing, PageNameEntry, normalizePageNames } from '@/lib/supabase';

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
  text_page_text_color: string;
  text_page_heading_color: string | null;
  text_page_font_size: string;
};

const DEFAULT_BRANDING: CompanyBranding = {
  name: '',
  logo_url: null,
  accent_color: '#ff6700',
  website: null,
  bg_primary: '#0f0f0f',
  bg_secondary: '#141414',
  sidebar_text_color: '#ffffff',
  accept_text_color: '#ffffff',
  cover_bg_style: 'gradient',
  cover_bg_color_1: '#0f0f0f',
  cover_bg_color_2: '#141414',
  cover_text_color: '#ffffff',
  cover_subtitle_color: '#ffffffb3',
  cover_button_bg: '#ff6700',
  cover_button_text: '#ffffff',
  cover_overlay_opacity: 0.65,
  cover_gradient_type: 'linear',
  cover_gradient_angle: 135,
  font_heading: null,
  font_body: null,
  font_sidebar: null,
  font_heading_weight: null,
  font_body_weight: null,
  font_sidebar_weight: null,
  text_page_bg_color: '#141414',
  text_page_text_color: '#ffffff',
  text_page_heading_color: null,
  text_page_font_size: '14',
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
  content: unknown; // TipTap JSON
  sort_order: number;
}

/* ─── Special page: represents a non-PDF page in the virtual sequence ── */

interface SpecialPage {
  type: 'pricing' | 'text';
  position: number;      // -1 = end, N = after PDF page N
  title: string;
  textPageId?: string;   // for text pages
  sortOrder?: number;     // for ordering among equal-position text pages
}

/**
 * Virtual page mapping:
 * PDF pages and special pages (pricing, text pages) are interleaved.
 * Each special page has a position:
 *  - position = -1  → appears at the end (after all PDF pages)
 *  - position = 0   → appears first (before first PDF page)
 *  - position = N   → appears after PDF page N
 *
 * The resulting virtualPage is the 1-indexed page number the user sees.
 */
function buildPageMap(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[]
) {
  // Collect all special pages
  const specials: SpecialPage[] = [];

  if (pricing?.enabled) {
    specials.push({
      type: 'pricing',
      position: pricing.position,
      title: pricing.title || 'Your Investment',
    });
  }

  for (const tp of textPages) {
    if (tp.enabled) {
      specials.push({
        type: 'text',
        position: tp.position,
        title: tp.title || 'Text Page',
        textPageId: tp.id,
        sortOrder: tp.sort_order,
      });
    }
  }

  if (specials.length === 0 || pdfPageCount === 0) {
    return {
      totalPages: pdfPageCount,
      pageSequence: [] as Array<{ type: 'pdf'; pdfPage: number } | { type: 'pricing' } | { type: 'text'; textPageId: string }>,
      isPricingPage: (_vp: number) => false,
      isTextPage: (_vp: number) => false,
      getTextPageId: (_vp: number): string | null => null,
      toPdfPage: (vp: number) => vp,
    };
  }

  // Build the virtual page sequence
  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
    | { type: 'pricing' }
    | { type: 'text'; textPageId: string };

  const sequence: VirtualPage[] = [];

  // Split specials into positioned (insert after specific PDF page) and trailing (position = -1)
  const positioned = specials.filter((s) => s.position >= 0);
  const trailing = specials.filter((s) => s.position === -1);

  // Sort positioned by their position, then by sortOrder for text pages
  positioned.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  // Build sequence: interleave PDF pages with positioned specials
  let posIdx = 0;
  for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
    // Insert any specials that come BEFORE this PDF page
    // position = 0 means before first PDF page
    while (posIdx < positioned.length && positioned[posIdx].position < pdfPage) {
      const sp = positioned[posIdx];
      if (sp.type === 'pricing') {
        sequence.push({ type: 'pricing' });
      } else {
        sequence.push({ type: 'text', textPageId: sp.textPageId! });
      }
      posIdx++;
    }

    sequence.push({ type: 'pdf', pdfPage });
  }

  // Insert remaining positioned specials (position >= pdfPageCount)
  while (posIdx < positioned.length) {
    const sp = positioned[posIdx];
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
    posIdx++;
  }

  // Add trailing specials
  trailing.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailing) {
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
  }

  const totalPages = sequence.length;

  const isPricingPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'pricing';
  };

  const isTextPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'text';
  };

  const getTextPageId = (vp: number): string | null => {
    const idx = vp - 1;
    if (idx >= 0 && idx < sequence.length && sequence[idx].type === 'text') {
      return (sequence[idx] as { type: 'text'; textPageId: string }).textPageId;
    }
    return null;
  };

  const toPdfPage = (vp: number): number => {
    const idx = vp - 1;
    if (idx < 0 || idx >= sequence.length) return -1;
    const entry = sequence[idx];
    if (entry.type === 'pdf') return entry.pdfPage;
    return -1; // Not a PDF page
  };

  return {
    totalPages,
    pageSequence: sequence,
    isPricingPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
  };
}

export function useProposal(token: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageEntries, setPageEntries] = useState<PageNameEntry[]>([]);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
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
    setPageEntries(normalizePageNames(data.page_names, 100));
    if (data.status === 'accepted') setAccepted(true);

    // Fetch company branding
    try {
      const brandingRes = await fetch(`/api/company/branding?company_id=${data.company_id}`);
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding(brandingData);
      }
    } catch {
      // Non-critical
    }
    setBrandingLoaded(true);

    // Fetch pricing data
    try {
      const pricingRes = await fetch(`/api/proposals/pricing?share_token=${token}`);
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        if (pricingData && pricingData.enabled) {
          setPricing(pricingData);
        }
      }
    } catch {
      // Non-critical
    }

    // Fetch text pages
    try {
      const textRes = await fetch(`/api/proposals/text-pages?share_token=${token}`);
      if (textRes.ok) {
        const textData: ProposalTextPage[] = await textRes.json();
        setTextPages(textData.filter((tp) => tp.enabled));
      }
    } catch {
      // Non-critical
    }

    // Check if the viewer is a logged-in team member
    let teamPreview = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        teamPreview = true;
      }
    } catch {
      // No session
    }
    setIsTeamPreview(teamPreview);

    // Only track views for actual client views
    if (!teamPreview) {
      const isFirstView = !data.first_viewed_at;

      const now = new Date().toISOString();
      const updates: Record<string, string> = { last_viewed_at: now };
      if (isFirstView) updates.first_viewed_at = now;
      if (data.status === 'sent' || data.status === 'draft') updates.status = 'viewed';

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

    const { data: signedData } = await supabase.storage
      .from('proposals')
      .createSignedUrl(data.file_path, 3600);

    if (signedData?.signedUrl) setPdfUrl(signedData.signedUrl);

    const { data: commentsData } = await supabase
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', data.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    setComments(commentsData || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  // Build virtual page map
  const pageMap = useMemo(
    () => buildPageMap(pdfPageCount, pricing, textPages),
    [pdfPageCount, pricing, textPages]
  );

  // Build page entries with special pages inserted for sidebar
  const allPageEntries = useMemo(() => {
    if (pdfPageCount === 0) return pageEntries;

    const pdfEntries = pageEntries.slice(0, pdfPageCount);

    if (!pageMap.pageSequence || pageMap.pageSequence.length === 0) {
      return pdfEntries;
    }

    return pageMap.pageSequence.map((entry) => {
      if (entry.type === 'pdf') {
        return pdfEntries[entry.pdfPage - 1] || { name: `Page ${entry.pdfPage}`, indent: 0 };
      } else if (entry.type === 'pricing') {
        return { name: pricing?.title || 'Your Investment', indent: 0 };
      } else {
        const tp = textPages.find((t) => t.id === entry.textPageId);
        return { name: tp?.title || 'Text Page', indent: 0 };
      }
    });
  }, [pageEntries, pdfPageCount, pricing, textPages, pageMap.pageSequence]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setPdfPageCount(n);
    setPageEntries((prev) => {
      const entries = [...prev];
      while (entries.length < n) entries.push({ name: `Page ${entries.length + 1}`, indent: 0 });
      return entries.slice(0, n);
    });
  };

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
    await supabase.from('proposals').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name: name,
    }).eq('id', proposal.id);
    setAccepted(true);
    notify({ event_type: 'proposal_accepted', share_token: token });
  };

  const submitComment = async (authorName: string, content: string, pageNumber: number) => {
    if (!proposal) return;
    const authorType = isTeamPreview ? 'team' : 'client';
    const { data: newComment } = await supabase.from('proposal_comments').insert({
      proposal_id: proposal.id,
      author_name: authorName,
      author_type: authorType,
      content,
      page_number: pageNumber,
      is_internal: false,
      company_id: proposal.company_id,
    }).select('id').single();

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
    const { data: newReply } = await supabase.from('proposal_comments').insert({
      proposal_id: proposal.id,
      author_name: authorName,
      author_type: authorType,
      content,
      page_number: parent?.page_number || null,
      is_internal: false,
      parent_id: parentId,
      company_id: proposal.company_id,
    }).select('id').single();

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

  // Get a text page by its ID
  const getTextPage = useCallback((textPageId: string): ProposalTextPage | undefined => {
    return textPages.find((tp) => tp.id === textPageId);
  }, [textPages]);

  return {
    proposal,
    pdfUrl,
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
    textPages,
    isPricingPage: pageMap.isPricingPage,
    isTextPage: pageMap.isTextPage,
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