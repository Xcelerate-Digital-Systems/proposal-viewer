// hooks/useProposal.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Proposal, ProposalComment, ProposalPricing, ProposalPackages, normalizePageNamesWithGroups,
  normalizePaymentSchedule, PageNameEntry, normalizePageNames, TocSettings, parseTocSettings } from '@/lib/supabase';
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
  show_title?: boolean
}

/* ─── Special page: represents a non-PDF page in the virtual sequence ── */

interface SpecialPage {
  type: 'pricing' | 'text' | 'packages' | 'toc';
  position: number;
  title: string;
  textPageId?: string;
  packagesId?: string;
  sortOrder?: number;
}

/**
 * Virtual page mapping:
 * PDF pages and special pages (pricing, packages, text pages) are interleaved.
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
  textPages: ProposalTextPage[],
  packages: ProposalPackages[],
  tocSettings?: TocSettings | null
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

  for (const pkg of packages) {
    if (pkg.enabled) {
      specials.push({
        type: 'packages',
        position: pkg.position,
        title: pkg.title || 'Packages',
        packagesId: pkg.id,
        sortOrder: pkg.sort_order ?? 0,
      });
    }
  }

  if (tocSettings?.enabled) {
    specials.push({
      type: 'toc',
      position: tocSettings.position,
      title: tocSettings.title || 'Table of Contents',
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
      pageSequence: [] as Array<{ type: 'pdf'; pdfPage: number } | { type: 'pricing' } | { type: 'packages'; packagesId: string } | { type: 'text'; textPageId: string } | { type: 'toc' }>,
      isPricingPage: (_vp: number) => false,
      isPackagesPage: (_vp: number) => false,
      getPackagesId: (_vp: number): string | null => null,
      isTocPage: (_vp: number) => false,
      isTextPage: (_vp: number) => false,
      getTextPageId: (_vp: number): string | null => null,
      toPdfPage: (vp: number) => vp,
    };
  }

  // Build the virtual page sequence
  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
    | { type: 'pricing' }
    | { type: 'packages'; packagesId: string }
    | { type: 'text'; textPageId: string }
    | { type: 'toc' };

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
      } else if (sp.type === 'packages') {
        sequence.push({ type: 'packages', packagesId: sp.packagesId! });
      } else if (sp.type === 'toc') {
        sequence.push({ type: 'toc' });
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
    } else if (sp.type === 'packages') {
      sequence.push({ type: 'packages', packagesId: sp.packagesId! });
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
    } else if (sp.type === 'packages') {
      sequence.push({ type: 'packages', packagesId: sp.packagesId! });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
  }

  const totalPages = sequence.length;

  const isPricingPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'pricing';
  };

  const isPackagesPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'packages';
  };

  const isTocPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'toc';
  };

  const isTextPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'text';
  };

  const getPackagesId = (vp: number): string | null => {
    const idx = vp - 1;
    if (idx >= 0 && idx < sequence.length && sequence[idx].type === 'packages') {
      return (sequence[idx] as { type: 'packages'; packagesId: string }).packagesId;
    }
    return null;
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
    isPackagesPage,
    getPackagesId,
    isTocPage,
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
    setPageEntries(normalizePageNames(data.page_names, 100));
    if (data.status === 'accepted') setAccepted(true);

    // Fetch company branding
    try {
      const brandingRes = await fetch(`/api/company/branding?company_id=${data.company_id}`);
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();

        // Entity-level bg image override (proposal → company fallback)
        // Entity-level bg image override (proposal → company fallback)
        if (data.bg_image_path) {
          const { data: bgUrlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.bg_image_path);
          if (bgUrlData?.publicUrl) {
            brandingData.bg_image_url = bgUrlData.publicUrl;
          }
          brandingData.bg_image_overlay_opacity = data.bg_image_overlay_opacity ?? brandingData.bg_image_overlay_opacity ?? 0.85;
        }

        // Entity-level text page style overrides (proposal → company fallback)
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

    // Fetch packages data
    try {
      const packagesRes = await fetch(`/api/proposals/packages?share_token=${token}`);
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        if (packagesData && packagesData.enabled) {
          setPackages(packagesData);
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
      if (data.status === 'sent') updates.status = 'viewed';

      await supabase.from('proposals').update(updates).eq('id', data.id);
      await supabase.from('proposal_views').insert({
        proposal_id: data.id,
        user_agent: navigator.userAgent,
        company_id: data.company_id,
      });

      if (isFirstView && data.status === 'sent') {
        notify({ event_type: 'proposal_viewed', share_token: token });
      }
    }

    const { data: signedData } = await supabase.storage
      .from('proposals')
      .createSignedUrl(data.file_path, 3600);

    if (signedData?.signedUrl) setPdfUrl(signedData.signedUrl + '&v=' + Date.now());

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
  // Parse TOC settings
  const tocSettings = proposal ? parseTocSettings(proposal.toc_settings) : null;

  // Build virtual page map
  const pageMap = useMemo(
    () => buildPageMap(pdfPageCount, pricing, textPages, packages, tocSettings),
    [pdfPageCount, pricing, textPages, packages, tocSettings]
  );

  // Build page entries with special pages inserted for sidebar
  // Groups (section headers) are preserved at their original positions relative to PDF pages
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
      // No special pages — return pageEntries as-is (groups preserved)
      return pageEntries;
    }

    // Build from page sequence, inserting groups before their associated PDF page
    const result: PageNameEntry[] = [];
    for (const seqEntry of pageMap.pageSequence) {
      if (seqEntry.type === 'pdf') {
        const pdfIndex = seqEntry.pdfPage - 1;
        // Emit any groups that precede this PDF page
        const groups = groupsBefore.get(pdfIndex);
        if (groups) result.push(...groups);
        // Emit the PDF page entry
        result.push(pdfEntries[pdfIndex] || { name: `Page ${seqEntry.pdfPage}`, indent: 0 });
      } else if (seqEntry.type === 'pricing') {
        result.push({
          name: pricing?.title || 'Your Investment',
          indent: pricing?.indent ?? 0,
          link_url: (pricing as Record<string, unknown>)?.link_url as string | undefined,
          link_label: (pricing as Record<string, unknown>)?.link_label as string | undefined,
        });
      } else if (seqEntry.type === 'packages') {
        const pkg = packages.find((p) => p.id === (seqEntry as { type: 'packages'; packagesId: string }).packagesId);
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

    // Append any trailing groups (groups after the last PDF page)
    result.push(...trailingGroups);

    return result;
  }, [pageEntries, pdfPageCount, pricing, packages, textPages, pageMap.pageSequence]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setPdfPageCount(n);
    setPageEntries((prev) => {
      // Separate groups from real page entries
      const groups: { beforePdfIndex: number; entry: PageNameEntry }[] = [];
      const realEntries: PageNameEntry[] = [];
      for (const entry of prev) {
        if (entry.type === 'group') {
          groups.push({ beforePdfIndex: realEntries.length, entry });
        } else {
          realEntries.push(entry);
        }
      }

      // Pad/trim real entries to match PDF page count
      while (realEntries.length < n) realEntries.push({ name: `Page ${realEntries.length + 1}`, indent: 0 });
      const trimmed = realEntries.slice(0, n);

      // Re-insert groups at their original positions (if still valid)
      const result: PageNameEntry[] = [];
      let realIdx = 0;
      let groupIdx = 0;
      while (realIdx < trimmed.length || groupIdx < groups.length) {
        // Insert any groups that belong before the current real entry
        while (groupIdx < groups.length && groups[groupIdx].beforePdfIndex <= realIdx) {
          result.push(groups[groupIdx].entry);
          groupIdx++;
        }
        if (realIdx < trimmed.length) {
          result.push(trimmed[realIdx]);
          realIdx++;
        }
      }
      // Trailing groups
      while (groupIdx < groups.length) {
        result.push(groups[groupIdx].entry);
        groupIdx++;
      }

      return result;
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
    creatorName: proposal?.created_by_name || null,
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