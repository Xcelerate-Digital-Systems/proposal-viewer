// hooks/useDocument.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  Document as DocType,
  PageNameEntry,
  TocSettings,
  parseTocSettings,
} from '@/lib/supabase';
import { CompanyBranding, PageUrlEntry } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface DocumentTextPage {
  id: string;
  document_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  title: string;
  content: unknown;
  sort_order: number;
  indent: number;
  link_url?: string | null;
  link_label?: string | null;
}

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useDocument(token: string) {
  const [document, setDocument] = useState<DocType | null>(null);
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      // 1. Fetch document by share token
      const { data: doc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('share_token', token)
        .single();

      if (error || !doc) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setDocument(doc as DocType);

      // 2. Fetch company branding
      try {
        const hostname = window.location.hostname;
        const res = await fetch(
          `/api/company/branding?domain=${hostname}&company_id=${doc.company_id}`
        );
        if (res.ok) {
          const data = await res.json();

          if (doc.bg_image_path) {
            const { data: bgUrlData } = supabase.storage
              .from('company-assets')
              .getPublicUrl(doc.bg_image_path);
            if (bgUrlData?.publicUrl) data.bg_image_url = bgUrlData.publicUrl;
            data.bg_image_overlay_opacity =
              doc.bg_image_overlay_opacity ?? data.bg_image_overlay_opacity ?? 0.85;
          }

          if (doc.text_page_bg_color != null) data.text_page_bg_color = doc.text_page_bg_color;
          if (doc.text_page_text_color != null) data.text_page_text_color = doc.text_page_text_color;
          if (doc.text_page_heading_color != null) data.text_page_heading_color = doc.text_page_heading_color;
          if (doc.text_page_font_size != null) data.text_page_font_size = doc.text_page_font_size;
          if (doc.text_page_border_enabled != null) data.text_page_border_enabled = doc.text_page_border_enabled;
          if (doc.text_page_border_color != null) data.text_page_border_color = doc.text_page_border_color;
          if (doc.text_page_border_radius != null) data.text_page_border_radius = doc.text_page_border_radius;
          if (doc.text_page_layout != null) data.text_page_layout = doc.text_page_layout;
          if (doc.title_font_family != null) data.title_font_family = doc.title_font_family;
          if (doc.title_font_weight != null) data.title_font_weight = doc.title_font_weight;
          if (doc.title_font_size != null) data.title_font_size = doc.title_font_size;
          if (doc.page_num_circle_color != null) data.page_num_circle_color = doc.page_num_circle_color;
          if (doc.page_num_text_color != null) data.page_num_text_color = doc.page_num_text_color;

          setBranding({ ...DEFAULT_BRANDING, ...data });
        }
      } catch { /* Use defaults */ }
      setBrandingLoaded(true);

      // 3. Fetch all pages (unified v2 — signed URLs included)
      try {
        const pageUrlRes = await fetch(`/api/documents/page-urls?share_token=${token}`);
        if (pageUrlRes.ok) {
          const pageUrlData = await pageUrlRes.json();
          const pages: PageUrlEntry[] = pageUrlData.pages ?? [];
          setPageUrls(pages);
        }
      } catch { /* Non-critical */ }

      setLoading(false);
    })();
  }, [token]);

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

  const tocSettings = document ? parseTocSettings((document as DocType).toc_settings) : null;

  // Virtual page type helpers
  const isTocPage  = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'toc',  [pageUrls]);
  const isTextPage = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'text', [pageUrls]);

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
        if (p.type === 'text') return { type: 'text' as const, textPageId: p.id };
        if (p.type === 'toc')  return { type: 'toc' as const };
        return { type: 'pdf' as const, pdfPage: 0 };
      }),
    [pageUrls],
  );

  const textPages: DocumentTextPage[] = useMemo(
    () =>
      pageUrls
        .filter((x) => x.type === 'text')
        .map((p) => ({
          id: p.id,
          document_id: document?.id ?? '',
          company_id: (document as DocType | null)?.company_id ?? '',
          enabled: true,
          position: p.position,
          title: p.title,
          content: p.payload.content ?? null,
          sort_order: p.position,
          indent: p.indent,
          link_url: p.link_url ?? null,
          link_label: p.link_label ?? null,
        })),
    [pageUrls, document],
  );

  const getPageName = useCallback(
    (page: number) => pageEntries[page - 1]?.name || `Page ${page}`,
    [pageEntries],
  );

  const getTextPage = useCallback(
    (textPageId: string): DocumentTextPage | undefined =>
      textPages.find((tp) => tp.id === textPageId),
    [textPages],
  );

  const onDocumentLoadSuccess = useCallback((_: { numPages: number }) => {
    // No-op in v2: page count comes from pageUrls.length
  }, []);

  return {
    document,
    pdfUrl: null, // v2: per-page URLs only
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
    textPages,
    isTocPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
    tocSettings,
    pageSequence,
    getTextPage,
    onDocumentLoadSuccess,
    getPageName,
  };
}

export { deriveBorderColor } from '@/hooks/useProposal';