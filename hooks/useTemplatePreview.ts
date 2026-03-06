// hooks/useTemplatePreview.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, PageNameEntry, normalizePageNamesWithGroups, ProposalPricing, ProposalPackages, TocSettings, parseTocSettings, parsePageOrder, PageOrderEntry } from '@/lib/supabase';
import { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { buildPageMap } from '@/lib/buildPageMap';


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
  const [pageOrder, setPageOrder] = useState<PageOrderEntry[] | null>(null);

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
      setPageOrder(parsePageOrder((tmpl as Record<string, unknown>).page_order));

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
    () => buildPageMap(pdfPageCount, pricing, textPages, packages, tocSettings, pageOrder),
    [pdfPageCount, pricing, textPages, packages, tocSettings, pageOrder]
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
        result.push({
          name: pricing?.title || 'Your Investment',
          indent: pricing?.indent ?? 0,
          link_url: (pricing as Record<string, unknown>)?.link_url as string | undefined,
          link_label: (pricing as Record<string, unknown>)?.link_label as string | undefined,
        });
      } else if (seqEntry.type === 'packages') {
        const pkg = packages.find((p) => p.id === (seqEntry as { type: 'packages'; packagesId: string }).packagesId);
        result.push({ name: pkg?.title || 'Packages', indent: pkg?.indent ?? 0 });
      } else if (seqEntry.type === 'toc') {
        result.push({ name: tocSettings?.title || 'Table of Contents', indent: 0 });
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