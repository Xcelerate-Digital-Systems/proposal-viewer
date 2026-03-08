// hooks/useTemplatePreview.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, PageNameEntry, TocSettings, parseTocSettings } from '@/lib/supabase';
import { CompanyBranding, ProposalTextPage, PageUrlEntry } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ─── Template data type ─────────────────────────────────────────────────── */

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
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

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export function useTemplatePreview(templateId: string) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

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

      // 2. Fetch branding
      try {
        const brandingRes = await fetch(`/api/company/branding?company_id=${tmpl.company_id}`);
        if (brandingRes.ok) {
          const brandingData = await brandingRes.json();

          if (tmpl.bg_image_path) {
            const { data: bgUrlData } = supabase.storage
              .from('company-assets')
              .getPublicUrl(tmpl.bg_image_path);
            if (bgUrlData?.publicUrl) brandingData.bg_image_url = bgUrlData.publicUrl;
            brandingData.bg_image_overlay_opacity =
              tmpl.bg_image_overlay_opacity ?? brandingData.bg_image_overlay_opacity ?? 0.85;
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
      } catch { /* Non-critical */ }
      setBrandingLoaded(true);

      // 3. Fetch all pages from v2 table, sign PDF page URLs client-side
      try {
        const pagesRes = await fetch(`/api/templates/pages?template_id=${templateId}`);
        if (pagesRes.ok) {
          const rawPages: Array<{
            id: string;
            position: number;
            type: string;
            title: string;
            indent: number;
            link_url: string | null;
            link_label: string | null;
            payload: Record<string, unknown>;
          }> = await pagesRes.json();

          // Sign URLs for PDF pages in parallel
          const signed = await Promise.all(
            rawPages.map(async (p) => {
              let url: string | null = null;
              if (p.type === 'pdf' && p.payload?.file_path) {
                const { data } = await supabase.storage
                  .from('proposals')
                  .createSignedUrl(p.payload.file_path as string, 3600);
                url = data?.signedUrl ?? null;
              }
              return {
                id: p.id,
                position: p.position,
                type: p.type as PageUrlEntry['type'],
                url,
                title: p.title,
                indent: p.indent,
                link_url: p.link_url ?? undefined,
                link_label: p.link_label ?? undefined,
                show_title: (p as Record<string, unknown>).show_title as boolean ?? true,
                show_member_badge: (p as Record<string, unknown>).show_member_badge as boolean ?? false,
                prepared_by_member_id: (p as Record<string, unknown>).prepared_by_member_id as string | null ?? null,
                payload: p.payload,
              };
            }),
          );

          setPageUrls(signed);
        }
      } catch { /* Non-critical */ }

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
  const pdfPageCount = useMemo(() => pageUrls.filter((p) => p.type === 'pdf').length, [pageUrls]);

  // First signed PDF URL — used for any legacy merged-PDF consumers (cover page, etc.)
  const pdfUrl = useMemo(
    () => pageUrls.find((p) => p.type === 'pdf')?.url ?? '',
    [pageUrls],
  );

  const tocSettings = template ? parseTocSettings(template.toc_settings) : null;

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
      let pdfCount = 0;
      for (let i = 0; i < vp - 1 && i < pageUrls.length; i++) {
        if (pageUrls[i].type === 'pdf') pdfCount++;
      }
      return pageUrls[vp - 1]?.type === 'pdf' ? pdfCount + 1 : -1;
    },
    [pageUrls],
  );

  const pageSequence = useMemo(
    () =>
      pageUrls.map((p) => {
        if (p.type === 'pdf') {
          const pdfIndex = pageUrls.slice(0, pageUrls.indexOf(p) + 1).filter((x) => x.type === 'pdf').length;
          return { type: 'pdf' as const, pdfPage: pdfIndex };
        }
        if (p.type === 'text')     return { type: 'text' as const, textPageId: p.id };
        if (p.type === 'pricing')  return { type: 'pricing' as const };
        if (p.type === 'packages') return { type: 'packages' as const, packagesId: p.id };
        if (p.type === 'toc')      return { type: 'toc' as const };
        return { type: 'pdf' as const, pdfPage: 0 };
      }),
    [pageUrls],
  );

  // Backward-compat extracted slices for viewer components
  const pricing = useMemo(() => {
    const p = pageUrls.find((x) => x.type === 'pricing');
    if (!p) return null;
    return { id: p.id, enabled: true, title: p.title, position: p.position, indent: p.indent, ...p.payload } as Record<string, unknown>;
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
          proposal_id: templateId, // satisfies type; consumers use id directly
          company_id: template?.company_id ?? '',
          enabled: true,
          position: p.position,
          title: p.title,
          content: p.payload.content ?? null,
          sort_order: p.position,
          indent: p.indent,
          link_url: p.link_url ?? null,
          link_label: p.link_label ?? null,
          show_title: p.show_title ?? true,
          show_member_badge: p.show_member_badge ?? false,
          prepared_by_member_id: p.prepared_by_member_id ?? null,
        })),
    [pageUrls, template, templateId],
  );

  const getPageName = (pageNum: number) =>
    pageEntries[pageNum - 1]?.name || `Page ${pageNum}`;

  const getTextPage = (id: string) => textPages.find((tp) => tp.id === id);

  const onDocumentLoadSuccess = useCallback((_: { numPages: number }) => {
    // No-op in v2: page count comes from pageUrls.length
  }, []);

  return {
    template,
    pdfUrl,
    pageUrls,
    numPages: numPages || pdfPageCount,
    pdfPageCount,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
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
    getTextPageId,
    getTextPage,
    toPdfPage,
    tocSettings,
    pageSequence,
    getPageName,
    onDocumentLoadSuccess,
  };
}