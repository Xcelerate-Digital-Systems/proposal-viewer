// hooks/useTemplatePreview.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, PageNameEntry, normalizePageNamesWithGroups, ProposalPricing } from '@/lib/supabase';
import { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';

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
  text_page_border_enabled: true,
  text_page_border_color: null,
  text_page_border_radius: '12',
  text_page_layout: 'contained',
};

/* ─── Special page: represents a non-PDF page in the virtual sequence ── */

interface SpecialPage {
  type: 'pricing' | 'text';
  position: number;
  title: string;
  textPageId?: string;
  sortOrder?: number;
}

function buildPageMap(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[]
) {
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

  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
    | { type: 'pricing' }
    | { type: 'text'; textPageId: string };

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
      } else {
        sequence.push({ type: 'text', textPageId: sp.textPageId! });
      }
      posIdx++;
    }
    sequence.push({ type: 'pdf', pdfPage });
  }

  // Remaining positioned specials (position >= pdfPageCount)
  while (posIdx < positioned.length) {
    const sp = positioned[posIdx];
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
    posIdx++;
  }

  // Trailing specials
  trailing.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailing) {
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
  }

  const totalPages = sequence.length;

  return {
    totalPages,
    pageSequence: sequence,
    isPricingPage: (vp: number) => {
      const idx = vp - 1;
      return idx >= 0 && idx < sequence.length && sequence[idx].type === 'pricing';
    },
    isTextPage: (vp: number) => {
      const idx = vp - 1;
      return idx >= 0 && idx < sequence.length && sequence[idx].type === 'text';
    },
    getTextPageId: (vp: number): string | null => {
      const idx = vp - 1;
      if (idx >= 0 && idx < sequence.length && sequence[idx].type === 'text') {
        return (sequence[idx] as { type: 'text'; textPageId: string }).textPageId;
      }
      return null;
    },
    toPdfPage: (vp: number): number => {
      const idx = vp - 1;
      if (idx < 0 || idx >= sequence.length) return -1;
      const entry = sequence[idx];
      if (entry.type === 'pdf') return entry.pdfPage;
      return -1;
    },
  };
}

/* ─── Template data shape ─────────────────────────────────────────────── */

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  page_count: number;
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string | null;
  page_names: unknown;
  section_headers: unknown;
  created_at: string;
  updated_at: string;
}

/* ─── Hook ─────────────────────────────────────────────────────────────── */

export function useTemplatePreview(templateId: string) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageEntries, setPageEntries] = useState<PageNameEntry[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
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

      // Build page entries from template's page_names + section_headers
      const { data: tPages } = await supabase
        .from('template_pages')
        .select('page_number, label, indent')
        .eq('template_id', templateId)
        .order('page_number', { ascending: true });

      const pdfCount = tPages?.length || 0;

      if (tPages && tPages.length > 0) {
        const entries: PageNameEntry[] = [];

        // If template has page_names with groups, use those
        if (tmpl.page_names && Array.isArray(tmpl.page_names)) {
          const normalized = normalizePageNamesWithGroups(tmpl.page_names, pdfCount);
          entries.push(...normalized);
        } else {
          // Fall back to labels from template_pages
          for (const p of tPages) {
            entries.push({
              name: p.label || `Page ${p.page_number}`,
              indent: p.indent || 0,
            });
          }
        }

        setPageEntries(entries);
      }

      // 2. Fetch branding
      try {
        const brandingRes = await fetch(`/api/company/branding?company_id=${tmpl.company_id}`);
        if (brandingRes.ok) {
          const brandingData = await brandingRes.json();
          setBranding(brandingData);
        }
      } catch {
        // Non-critical
      }
      setBrandingLoaded(true);

      // 3. Merge template pages into single PDF
      try {
        const mergeRes = await fetch(`/api/templates/merge-pdf?template_id=${templateId}`);
        if (mergeRes.ok) {
          const mergeData = await mergeRes.json();
          setPdfUrl(mergeData.pdf_url);
          setPdfPageCount(mergeData.page_count);
        }
      } catch {
        console.error('Failed to merge template PDF');
      }

      // 4. Fetch template pricing
      try {
        const pricingRes = await fetch(`/api/templates/pricing?template_id=${templateId}`);
        if (pricingRes.ok) {
          const pricingData = await pricingRes.json();
          if (pricingData && pricingData.enabled) {
            setPricing(pricingData);
          }
        }
      } catch {
        // Non-critical
      }

      // 5. Fetch template text pages
      try {
        const textRes = await fetch(`/api/templates/text-pages?template_id=${templateId}`);
        if (textRes.ok) {
          const textData = await textRes.json();
          setTextPages(Array.isArray(textData) ? textData.filter((tp: ProposalTextPage) => tp.enabled) : []);
        }
      } catch {
        // Non-critical
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

  // Build virtual page map
  const pageMap = useMemo(
    () => buildPageMap(pdfPageCount, pricing, textPages),
    [pdfPageCount, pricing, textPages]
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
        result.push({ name: pricing?.title || 'Your Investment', indent: 0 });
      } else {
        const tp = textPages.find((t) => t.id === seqEntry.textPageId);
        result.push({ name: tp?.title || 'Text Page', indent: 0 });
      }
    }

    result.push(...trailingGroups);
    return result;
  }, [pageEntries, pdfPageCount, pricing, textPages, pageMap.pageSequence]);

  // Total virtual pages
  const numPages = pageMap.totalPages > 0 ? pageMap.totalPages : pdfPageCount;

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setPdfPageCount(n);
  };

  const getPageName = (pageNum: number) => {
    return allPageEntries[pageNum - 1]?.name || `Page ${pageNum}`;
  };

  const getTextPage = (id: string) => textPages.find((tp) => tp.id === id);

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
    isPricingPage: pageMap.isPricingPage,
    isTextPage: pageMap.isTextPage,
    getTextPageId: pageMap.getTextPageId,
    getTextPage,
    toPdfPage: pageMap.toPdfPage,
    onDocumentLoadSuccess,
    getPageName,
  };
}