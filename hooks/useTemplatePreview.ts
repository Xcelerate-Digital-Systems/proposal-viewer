// hooks/useTemplatePreview.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, PageNameEntry, normalizePageNamesWithGroups, ProposalPricing, ProposalPackages, TocSettings, parseTocSettings } from '@/lib/supabase';
import { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ─── Special page: represents a non-PDF page in the virtual sequence ── */

interface SpecialPage {
  type: 'pricing' | 'text' | 'packages' | 'toc';
  position: number;
  title: string;
  textPageId?: string;
  sortOrder?: number;
}

function buildPageMap(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[],
  packages: ProposalPackages | null,
  tocSettings?: TocSettings | null
) {
  const specials: SpecialPage[] = [];

  if (pricing?.enabled) {
    specials.push({
      type: 'pricing',
      position: pricing.position,
      title: pricing.title || 'Your Investment',
    });
  }

  if (packages?.enabled) {
    specials.push({
      type: 'packages',
      position: packages.position,
      title: packages.title || 'Packages',
    });
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
      pageSequence: [] as Array<
        { type: 'pdf'; pdfPage: number } | { type: 'pricing' } | { type: 'packages' } | { type: 'text'; textPageId: string } | { type: 'toc' }
      >,
      isPricingPage: (_vp: number) => false,
      isPackagesPage: (_vp: number) => false,
      isTocPage: (_vp: number) => false,
      isTextPage: (_vp: number) => false,
      getTextPageId: (_vp: number): string | null => null,
      toPdfPage: (vp: number) => vp,
    };
  }

  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
    | { type: 'pricing' }
    | { type: 'packages' }
    | { type: 'text'; textPageId: string }
    | { type: 'toc' };

  const sequence: VirtualPage[] = [];

  const positioned = specials.filter((s) => s.position >= 0);
  const trailing = specials.filter((s) => s.position === -1);

  positioned.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  let posIdx = 0;
  for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
    while (posIdx < positioned.length && positioned[posIdx].position < pdfPage) {
      const sp = positioned[posIdx];
      if (sp.type === 'pricing') {
        sequence.push({ type: 'pricing' });
      } else if (sp.type === 'packages') {
        sequence.push({ type: 'packages' });
      } else if (sp.type === 'toc') {
        sequence.push({ type: 'toc' });
      } else {
        sequence.push({ type: 'text', textPageId: sp.textPageId! });
      }
      posIdx++;
    }
    sequence.push({ type: 'pdf', pdfPage });
  }

  while (posIdx < positioned.length) {
    const sp = positioned[posIdx];
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else if (sp.type === 'packages') {
      sequence.push({ type: 'packages' });
    } else if (sp.type === 'toc') {
      sequence.push({ type: 'toc' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
    posIdx++;
  }

  trailing.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailing) {
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else if (sp.type === 'packages') {
      sequence.push({ type: 'packages' });
    } else if (sp.type === 'toc') {
      sequence.push({ type: 'toc' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
  }

  const totalPages = sequence.length;

  const isPricingPage = (vp: number) => sequence[vp - 1]?.type === 'pricing';
  const isPackagesPage = (vp: number) => sequence[vp - 1]?.type === 'packages';
  const isTocPage = (vp: number) => sequence[vp - 1]?.type === 'toc';
  const isTextPage = (vp: number) => sequence[vp - 1]?.type === 'text';
  const getTextPageId = (vp: number): string | null => {
    const entry = sequence[vp - 1];
    return entry?.type === 'text' ? entry.textPageId : null;
  };
  const toPdfPage = (vp: number): number => {
    const entry = sequence[vp - 1];
    return entry?.type === 'pdf' ? entry.pdfPage : 0;
  };

  return {
    totalPages,
    pageSequence: sequence,
    isPricingPage,
    isPackagesPage,
    isTocPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
  };
}

/* ─── Template data type ───────────────────────────────────────────── */

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  page_count: number;
  file_path: string | null;
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string;
  cover_bg_style: string | null;
  cover_bg_color_1: string | null;
  cover_bg_color_2: string | null;
  cover_gradient_type: string | null;
  cover_gradient_angle: number | null;
  cover_overlay_opacity: number | null;
  cover_text_color: string | null;
  cover_subtitle_color: string | null;
  cover_button_bg: string | null;
  cover_button_text_color: string | null;
  cover_date: string | null;
  cover_show_date: boolean;
  cover_show_prepared_by: boolean;
  cover_show_client_logo: boolean;
  cover_show_avatar: boolean;
  cover_avatar_path: string | null;
  cover_client_logo_path: string | null;
  prepared_by: string | null;
  prepared_by_member_id: string | null;
  company_id: string;
  page_names: unknown;
  section_headers: unknown;
  toc_settings: unknown;
  bg_image_path: string | null;
  bg_image_overlay_opacity: number | null;
  text_page_bg_color: string | null;
  text_page_text_color: string | null;
  text_page_heading_color: string | null;
  text_page_font_size: string | null;
  text_page_border_enabled: boolean | null;
  text_page_border_color: string | null;
  text_page_border_radius: string | null;
  text_page_layout: string | null;
  created_at: string;
  title_font_family: string | null;
  title_font_weight: string | null;
  title_font_size: string | null;
  updated_at: string;
  page_num_circle_color: string | null;
  page_num_text_color: string | null;
}

/* ─── Hook ─────────────────────────────────────────────────────────────── */

export function useTemplatePreview(templateId: string) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  /** Single signed URL for the merged PDF (same approach as proposals) */
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageEntries, setPageEntries] = useState<PageNameEntry[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
  const [packages, setPackages] = useState<ProposalPackages | null>(null);
  const [textPages, setTextPages] = useState<ProposalTextPage[]>([]);

  const fetchTemplate = useCallback(async () => {
    try {
      // 1. Fetch template data
      const { data: tmpl, error } = await supabase
        .from('proposal_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error || !tmpl) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTemplate(tmpl);

      // Build page entries from template_pages (for sidebar labels/indents)
      const { data: tPages } = await supabase
        .from('template_pages')
        .select('page_number, label, indent')
        .eq('template_id', templateId)
        .order('page_number', { ascending: true });

      const pdfCount = tPages?.length || 0;
      setPdfPageCount(pdfCount);

      if (tPages && tPages.length > 0) {
        const entries: PageNameEntry[] = [];

        // Always build from template_pages records (source of truth after page CRUD).
        // page_names JSON on the template record can be stale after insert/delete.
        for (const p of tPages) {
          entries.push({
            name: p.label || `Page ${p.page_number}`,
            indent: p.indent || 0,
          });
        }

        // Re-insert section headers (groups) from page_names if present,
        // since groups aren't stored in template_pages.
        if (tmpl.page_names && Array.isArray(tmpl.page_names)) {
          const normalized = normalizePageNamesWithGroups(tmpl.page_names, pdfCount);
          let groupOffset = 0;
          for (let i = 0; i < normalized.length; i++) {
            if (normalized[i].type === 'group') {
              const insertIdx = Math.min(i + groupOffset, entries.length);
              entries.splice(insertIdx, 0, normalized[i]);
            }
          }
        }

        setPageEntries(entries);
      }

      // 2. Fetch branding
      try {
        const brandingRes = await fetch(`/api/company/branding?company_id=${tmpl.company_id}`);
        if (brandingRes.ok) {
          const brandingData = await brandingRes.json();

          // Entity-level bg image override (template → company fallback)
          if (tmpl.bg_image_path) {
            const { data: bgUrlData } = supabase.storage
              .from('company-assets')
              .getPublicUrl(tmpl.bg_image_path);
            if (bgUrlData?.publicUrl) {
              brandingData.bg_image_url = bgUrlData.publicUrl;
            }
            brandingData.bg_image_overlay_opacity = tmpl.bg_image_overlay_opacity ?? brandingData.bg_image_overlay_opacity ?? 0.85;
          }

          // Entity-level text page style overrides (template → company fallback)
          if (tmpl.text_page_bg_color != null) brandingData.text_page_bg_color = tmpl.text_page_bg_color;
          if (tmpl.text_page_text_color != null) brandingData.text_page_text_color = tmpl.text_page_text_color;
          if (tmpl.text_page_heading_color != null) brandingData.text_page_heading_color = tmpl.text_page_heading_color;
          if (tmpl.text_page_font_size != null) brandingData.text_page_font_size = tmpl.text_page_font_size;
          if (tmpl.text_page_border_enabled != null) brandingData.text_page_border_enabled = tmpl.text_page_border_enabled;
          if (tmpl.text_page_border_color != null) brandingData.text_page_border_color = tmpl.text_page_border_color;
          if (tmpl.text_page_border_radius != null) brandingData.text_page_border_radius = tmpl.text_page_border_radius;
          if (tmpl.text_page_layout != null) brandingData.text_page_layout = tmpl.text_page_layout;
          if (tmpl.title_font_family != null) brandingData.title_font_family = tmpl.title_font_family;
          if (tmpl.title_font_weight != null) brandingData.title_font_weight = tmpl.title_font_weight;
          if (tmpl.title_font_size != null) brandingData.title_font_size = tmpl.title_font_size;
          if (tmpl.page_num_circle_color != null) brandingData.page_num_circle_color = tmpl.page_num_circle_color;
          if (tmpl.page_num_text_color != null) brandingData.page_num_text_color = tmpl.page_num_text_color;


          setBranding(brandingData);
        }
      } catch {
        // Non-critical
      }
      setBrandingLoaded(true);

      // 3. Fetch signed URL for merged PDF (same approach as proposals)
      if (tmpl.file_path) {
        const { data: signedData } = await supabase.storage
          .from('proposals')
          .createSignedUrl(tmpl.file_path, 3600);

        if (signedData?.signedUrl) {
          setPdfUrl(signedData.signedUrl + '&v=' + Date.now());
        }
      }

      // 4–6. Fetch pricing, packages, text pages in parallel
      const [pricingRes, pkgRes, textRes] = await Promise.all([
        fetch(`/api/templates/pricing?template_id=${templateId}`).catch(() => null),
        fetch(`/api/templates/packages?template_id=${templateId}`).catch(() => null),
        fetch(`/api/templates/text-pages?template_id=${templateId}`).catch(() => null),
      ]);

      // 4. Pricing
      if (pricingRes?.ok) {
        try {
          const pricingData = await pricingRes.json();
          if (pricingData && pricingData.enabled) {
            setPricing(pricingData);
          }
        } catch { /* Non-critical */ }
      }

      // 5. Packages
      if (pkgRes?.ok) {
        try {
          const pkgData = await pkgRes.json();
          if (pkgData && pkgData.enabled) {
            setPackages({
              ...pkgData,
              proposal_id: templateId, // Map template_id → proposal_id for component compat
            });
          }
        } catch { /* Non-critical */ }
      }

      // 6. Text pages
      if (textRes?.ok) {
        try {
          const textData = await textRes.json();
          setTextPages(
            Array.isArray(textData) ? textData.filter((tp: ProposalTextPage) => tp.enabled) : []
          );
        } catch { /* Non-critical */ }
      }

      setLoading(false);
    } catch (err) {
      console.error('Template preview fetch error:', err);
      setNotFound(true);
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Parse TOC settings
  const tocSettings = template ? parseTocSettings(template.toc_settings) : null;

  // Build virtual page map
  const pageMap = useMemo(
    () => buildPageMap(pdfPageCount, pricing, textPages, packages, tocSettings),
    [pdfPageCount, pricing, textPages, packages, tocSettings]
  );

  // Build page entries with special pages inserted for sidebar
  const allPageEntries = useMemo(() => {
    if (pdfPageCount === 0) return pageEntries;

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
        result.push({ name: pricing?.title || 'Your Investment', indent: pricing?.indent ?? 0 });
      } else if (seqEntry.type === 'packages') {
        result.push({ name: packages?.title || 'Packages', indent: packages?.indent ?? 0 });
      } else if (seqEntry.type === 'toc') {
        result.push({ name: tocSettings?.title || 'Table of Contents', indent: 0 });
      } else {
        const tp = textPages.find((t) => t.id === seqEntry.textPageId);
        result.push({ name: tp?.title || 'Text Page', indent: tp?.indent ?? 0 });
      }
    }

    result.push(...trailingGroups);
    return result;
  }, [pageEntries, pdfPageCount, pricing, packages, textPages, tocSettings, pageMap.pageSequence]);

  // Total virtual pages
  const numPages = pageMap.totalPages > 0 ? pageMap.totalPages : pdfPageCount;

  const getPageName = (pageNum: number) => {
    return allPageEntries[pageNum - 1]?.name || `Page ${pageNum}`;
  };

  const getTextPage = (id: string) => textPages.find((tp) => tp.id === id);

  // Callback for when PdfViewer loads the document (safety net for page count)
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
        while (groupIdx < groups.length && groups[groupIdx].beforePdfIndex <= realIdx) {
          result.push(groups[groupIdx].entry);
          groupIdx++;
        }
        if (realIdx < trimmed.length) {
          result.push(trimmed[realIdx]);
          realIdx++;
        }
      }
      while (groupIdx < groups.length) {
        result.push(groups[groupIdx].entry);
        groupIdx++;
      }

      return result;
    });
  };

  return {
    template,
    pdfUrl,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries: allPageEntries,
    branding,
    brandingLoaded,
    pricing,
    packages,
    isPricingPage: pageMap.isPricingPage,
    isPackagesPage: pageMap.isPackagesPage,
    isTocPage: pageMap.isTocPage,
    isTextPage: pageMap.isTextPage,
    getTextPageId: pageMap.getTextPageId,
    getTextPage,
    toPdfPage: pageMap.toPdfPage,
    tocSettings,
    pageSequence: pageMap.pageSequence,
    getPageName,
    onDocumentLoadSuccess,
  };
}