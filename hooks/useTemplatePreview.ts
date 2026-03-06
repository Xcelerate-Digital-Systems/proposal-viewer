// hooks/useTemplatePreview.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, PageNameEntry, normalizePageNamesWithGroups, ProposalPricing, ProposalPackages, TocSettings, parseTocSettings } from '@/lib/supabase';
import { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ─── Special page ──────────────────────────────────────────────────── */

interface SpecialPage {
  type: 'pricing' | 'text' | 'packages' | 'toc';
  position: number;
  title: string;
  textPageId?: string;
  packagesId?: string;
  sortOrder?: number;
  indent?: number;
}

function buildPageMap(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[],
  packages: ProposalPackages[],
  tocSettings?: TocSettings | null
) {
  const specials: SpecialPage[] = [];

  if (pricing?.enabled) {
    specials.push({ type: 'pricing', position: pricing.position, title: pricing.title || 'Your Investment' });
  }

  for (const pkg of packages) {
    if (pkg.enabled) {
      specials.push({
        type: 'packages',
        position: pkg.position,
        title: pkg.title || 'Packages',
        packagesId: pkg.id,
        sortOrder: pkg.sort_order ?? 0,
        indent: pkg.indent ?? 0,
      });
    }
  }

  if (tocSettings?.enabled) {
    specials.push({ type: 'toc', position: tocSettings.position, title: tocSettings.title || 'Table of Contents' });
  }

  for (const tp of textPages) {
    if (tp.enabled) {
      specials.push({ type: 'text', position: tp.position, title: tp.title || 'Text Page', textPageId: tp.id, sortOrder: tp.sort_order });
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

  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
    | { type: 'pricing' }
    | { type: 'packages'; packagesId: string }
    | { type: 'text'; textPageId: string }
    | { type: 'toc' };

  const sequence: VirtualPage[] = [];

  const positioned = specials.filter((s) => s.position >= 0);
  const trailing = specials.filter((s) => s.position === -1);

  // Sort positioned by position, then by type order, then by sortOrder.
  // Type order mirrors PageEditor's splice insertion order: pricing is inserted
  // first (ends up last due to later splices at the same index), text pages are
  // inserted last (end up first). So: text=0, packages=1, toc=2, pricing=3.
  const positionedTypeOrder = (type: string) => {
    if (type === 'text') return 0;
    if (type === 'packages') return 1;
    if (type === 'toc') return 2;
    return 3; // pricing
  };
  // AFTER
  positioned.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const ta = positionedTypeOrder(a.type), tb = positionedTypeOrder(b.type);
    if (ta !== tb) return ta - tb;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  // Co-locate child packages (indent > 0) immediately after their nearest parent.
  // This handles cases where a child has a different `position` value than its parent.
  const colocateChildren = (arr: SpecialPage[]): SpecialPage[] => {
    const result: SpecialPage[] = [];
    for (const sp of arr) {
      if (sp.type === 'packages' && (sp.indent ?? 0) > 0) {
        let insertAt = result.length;
        for (let i = result.length - 1; i >= 0; i--) {
          if (result[i].type === 'packages' && (result[i].indent ?? 0) === 0) {
            insertAt = i + 1;
            while (insertAt < result.length && result[insertAt].type === 'packages' && (result[insertAt].indent ?? 0) > 0) {
              insertAt++;
            }
            break;
          }
        }
        result.splice(insertAt, 0, sp);
      } else {
        result.push(sp);
      }
    }
    return result;
  };
  const positionedFinal = colocateChildren(positioned);
  const trailingFinal = colocateChildren(trailing);

  // Build sequence: interleave PDF pages with positioned specials

  let posIdx = 0;
  for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
    while (posIdx < positionedFinal.length && positionedFinal[posIdx].position < pdfPage) {
      const sp = positionedFinal[posIdx];
      if (sp.type === 'pricing') sequence.push({ type: 'pricing' });
      else if (sp.type === 'packages') sequence.push({ type: 'packages', packagesId: sp.packagesId! });
      else if (sp.type === 'toc') sequence.push({ type: 'toc' });
      else sequence.push({ type: 'text', textPageId: sp.textPageId! });
      posIdx++;
    }
    sequence.push({ type: 'pdf', pdfPage });
  }

  while (posIdx < positionedFinal.length) {
    const sp = positionedFinal[posIdx];
    if (sp.type === 'pricing') sequence.push({ type: 'pricing' });
    else if (sp.type === 'packages') sequence.push({ type: 'packages', packagesId: sp.packagesId! });
    else if (sp.type === 'toc') sequence.push({ type: 'toc' });
    else sequence.push({ type: 'text', textPageId: sp.textPageId! });
    posIdx++;
  }

  trailingFinal.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailingFinal) {
    if (sp.type === 'pricing') sequence.push({ type: 'pricing' });
    else if (sp.type === 'packages') sequence.push({ type: 'packages', packagesId: sp.packagesId! });
    else if (sp.type === 'toc') sequence.push({ type: 'toc' });
    else sequence.push({ type: 'text', textPageId: sp.textPageId! });
  }

  const totalPages = sequence.length;

  const isPricingPage = (vp: number) => sequence[vp - 1]?.type === 'pricing';
  const isPackagesPage = (vp: number) => sequence[vp - 1]?.type === 'packages';
  const isTocPage = (vp: number) => sequence[vp - 1]?.type === 'toc';
  const isTextPage = (vp: number) => sequence[vp - 1]?.type === 'text';

  const getPackagesId = (vp: number): string | null => {
    const entry = sequence[vp - 1];
    return entry?.type === 'packages' ? (entry as { type: 'packages'; packagesId: string }).packagesId : null;
  };

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
    getPackagesId,
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

/* ─── Hook ─────────────────────────────────────────────────────────── */

export function useTemplatePreview(templateId: string) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageEntries, setPageEntries] = useState<PageNameEntry[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
  const [packages, setPackages] = useState<ProposalPackages[]>([]);
  const [textPages, setTextPages] = useState<ProposalTextPage[]>([]);

  const fetchTemplate = useCallback(async () => {
    try {
      // 1. Fetch template
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

      setTemplate(tmpl as TemplateData);

        // Fetch template_pages for real labels and indents
        const { data: tPages } = await supabase
          .from('template_pages')
          .select('page_number, label, indent, link_url, link_label')
          .eq('template_id', templateId)
          .order('page_number', { ascending: true });

        const pdfCount = tPages?.length ?? 0;
        const normalized = normalizePageNamesWithGroups(tmpl.page_names, pdfCount);

        let pdfIdx = 0;
        const builtEntries: PageNameEntry[] = normalized.map((entry) => {
          if (entry.type === 'group') return entry;
          pdfIdx++;
          const tPage = tPages?.find((p) => p.page_number === pdfIdx);
          return {
            name: tPage?.label || entry.name || `Page ${pdfIdx}`,
            indent: tPage?.indent ?? entry.indent ?? 0,
            ...((tPage as any)?.link_url ? { link_url: (tPage as any).link_url } : {}),
            ...((tPage as any)?.link_label ? { link_label: (tPage as any).link_label } : {}),
          };
        });
        setPageEntries(builtEntries);

      // 2. Fetch branding
      try {
        const brandingRes = await fetch(`/api/company/branding?company_id=${tmpl.company_id}`);
        if (brandingRes.ok) {
          const brandingData = await brandingRes.json();

          if (tmpl.bg_image_path) {
            const { data: bgUrlData } = supabase.storage
              .from('company-assets')
              .getPublicUrl(tmpl.bg_image_path);
            if (bgUrlData?.publicUrl) {
              brandingData.bg_image_url = bgUrlData.publicUrl;
            }
            brandingData.bg_image_overlay_opacity = tmpl.bg_image_overlay_opacity ?? brandingData.bg_image_overlay_opacity ?? 0.85;
          }

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

      // 3. Fetch signed URL for merged PDF
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
          setPackages(Array.isArray(pkgData) ? pkgData : []);
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
        const pkg = packages.find((p) => p.id === (seqEntry as { type: 'packages'; packagesId: string }).packagesId);
        result.push({ name: pkg?.title || 'Packages', indent: pkg?.indent ?? 0 });
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

  const numPages = pageMap.totalPages > 0 ? pageMap.totalPages : pdfPageCount;

  const getPageName = (pageNum: number) => {
    return allPageEntries[pageNum - 1]?.name || `Page ${pageNum}`;
  };

  const getTextPage = (id: string) => textPages.find((tp) => tp.id === id);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setPdfPageCount(n);
    setPageEntries((prev) => {
      const groups: { beforePdfIndex: number; entry: PageNameEntry }[] = [];
      const realEntries: PageNameEntry[] = [];
      for (const entry of prev) {
        if (entry.type === 'group') {
          groups.push({ beforePdfIndex: realEntries.length, entry });
        } else {
          realEntries.push(entry);
        }
      }

      while (realEntries.length < n) realEntries.push({ name: `Page ${realEntries.length + 1}`, indent: 0 });
      const trimmed = realEntries.slice(0, n);

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
    getPackagesId: pageMap.getPackagesId,
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