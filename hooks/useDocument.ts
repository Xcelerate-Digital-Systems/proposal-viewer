// hooks/useDocument.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  Document as DocType,
  PageNameEntry,
  normalizePageNamesWithGroups,
  TocSettings,
  parseTocSettings,
} from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor, PageUrlEntry } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ─── Text page type ───────────────────────────────────────────────── */

export interface DocumentTextPage {
  id: string;
  document_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  title: string;
  content: unknown; // TipTap JSON
  sort_order: number;
  indent: number;
  link_url?: string | null;
  link_label?: string | null;
}

/* ─── Special page: represents a non-PDF page in the virtual sequence ── */

interface SpecialPage {
  type: 'text' | 'toc';
  position: number;      // -1 = end, N = after PDF page N
  title: string;
  textPageId?: string;
  sortOrder?: number;
}

/**
 * Virtual page mapping for documents (text pages + TOC, no pricing).
 */
function buildDocumentPageMap(
  pdfPageCount: number,
  textPages: DocumentTextPage[],
  tocSettings?: TocSettings | null
) {
  const specials: SpecialPage[] = [];

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
        | { type: 'pdf'; pdfPage: number }
        | { type: 'text'; textPageId: string }
        | { type: 'toc' }
      >,
      isTocPage: (_vp: number) => false,
      isTextPage: (_vp: number) => false,
      getTextPageId: (_vp: number): string | null => null,
      toPdfPage: (vp: number) => vp,
    };
  }

  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
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
      if (sp.type === 'toc') {
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
    if (sp.type === 'toc') {
      sequence.push({ type: 'toc' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
    posIdx++;
  }

  trailing.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailing) {
    if (sp.type === 'toc') {
      sequence.push({ type: 'toc' });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
  }

  const totalPages = sequence.length;

  const isTocPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'toc';
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
    return -1;
  };

  return {
    totalPages,
    pageSequence: sequence,
    isTocPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
  };
}

export function useDocument(token: string) {
  const [document, setDocument] = useState<DocType | null>(null);
  // Legacy single signed URL — populated only when document_pages rows don't exist yet (fallback)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // Per-page signed URLs — primary path post-migration
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [textPages, setTextPages] = useState<DocumentTextPage[]>([]);

  // Fetch document + branding + text pages + page URLs
  useEffect(() => {
    if (!token) return;

    (async () => {
      // 1. Fetch the document by share token
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

          // Entity-level bg image override (document → company fallback)
          if (doc.bg_image_path) {
            const { data: bgUrlData } = supabase.storage
              .from('company-assets')
              .getPublicUrl(doc.bg_image_path);
            if (bgUrlData?.publicUrl) {
              data.bg_image_url = bgUrlData.publicUrl;
            }
            data.bg_image_overlay_opacity =
              doc.bg_image_overlay_opacity ?? data.bg_image_overlay_opacity ?? 0.85;
          }

          // Entity-level text page style overrides (document → company fallback)
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
      } catch {
        // Use defaults
      }
      setBrandingLoaded(true);

      // 3. Fetch text pages
      try {
        const textRes = await fetch(`/api/documents/text-pages?share_token=${token}`);
        if (textRes.ok) {
          const textData: DocumentTextPage[] = await textRes.json();
          setTextPages(textData.filter((tp) => tp.enabled));
        }
      } catch {
        // Non-critical
      }

      // ── Per-page URL fetch (primary path) ──────────────────────────────
      try {
        const pageUrlRes = await fetch(`/api/proposals/page-urls?share_token=${token}`);
        if (pageUrlRes.ok) {
          const pageUrlData = await pageUrlRes.json();

          if (pageUrlData.fallback) {
            // Pre-backfill: no document_pages rows yet — fall back to legacy merged PDF
            if (doc.file_path) {
              const { data: urlData } = await supabase.storage
                .from('proposals')
                .createSignedUrl(doc.file_path, 3600);
              if (urlData?.signedUrl) {
                setPdfUrl(urlData.signedUrl + '&v=' + Date.now());
              }
            }
          } else {
            // Per-page path: set URLs and derive page count immediately
            const pages: PageUrlEntry[] = pageUrlData.pages ?? [];
            setPageUrls(pages);
            setPdfPageCount(pages.length);
            // Keep pdfUrl null — PdfViewer will consume pageUrls directly
          }
        } else {
          // API error — fall back to legacy signed URL
          if (doc.file_path) {
            const { data: urlData } = await supabase.storage
              .from('proposals')
              .createSignedUrl(doc.file_path, 3600);
            if (urlData?.signedUrl) {
              setPdfUrl(urlData.signedUrl + '&v=' + Date.now());
            }
          }
        }
      } catch {
        // Network error — fall back to legacy signed URL
        if (doc.file_path) {
          const { data: urlData } = await supabase.storage
            .from('proposals')
            .createSignedUrl(doc.file_path, 3600);
          if (urlData?.signedUrl) {
            setPdfUrl(urlData.signedUrl + '&v=' + Date.now());
          }
        }
      }

      setLoading(false);
    })();
  }, [token]);

  // Build a lookup map from per-page data for label/indent/link overlay
  const pageUrlMap = useMemo<Map<number, PageUrlEntry>>(() => {
    const map = new Map<number, PageUrlEntry>();
    for (const p of pageUrls) map.set(p.page_number, p);
    return map;
  }, [pageUrls]);

  // Normalize page names — groups come from page_names JSONB; labels/indents/links
  // are overlaid from document_pages rows (via pageUrlMap) when available.
  const pageEntries: PageNameEntry[] = useMemo(() => {
    if (!document && pageUrls.length === 0) return [];

    if (pageUrls.length > 0) {
      // Per-page path: overlay labels/indents/links from pageUrls, preserve group entries
      const normalized = normalizePageNamesWithGroups(
        (document as DocType | null)?.page_names,
        pdfPageCount
      );
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
    return normalizePageNamesWithGroups(
      (document as DocType | null)?.page_names,
      pdfPageCount
    );
  }, [document, pdfPageCount, pageUrls, pageUrlMap]);

  // Parse TOC settings
  const tocSettings = document ? parseTocSettings((document as DocType).toc_settings) : null;

  // Build virtual page map
  const pageMap = useMemo(
    () => buildDocumentPageMap(pdfPageCount, textPages, tocSettings),
    [pdfPageCount, textPages, tocSettings]
  );

  // Build page entries with text pages interleaved for sidebar.
  // Groups (section headers) are preserved at their original positions relative to PDF pages.
  const allPageEntries = useMemo(() => {
    if (pdfPageCount === 0) return pageEntries;

    // Separate groups from real page entries
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
  }, [pageEntries, pdfPageCount, textPages, tocSettings, pageMap.pageSequence]);

  // onDocumentLoadSuccess: only updates pdfPageCount in legacy fallback mode.
  // In per-page mode (pageUrls.length > 0) the count is already set from pageUrls.length.
  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      if (pageUrls.length === 0) {
        setPdfPageCount(n);
      }
    },
    [pageUrls.length]
  );

  const getPageName = useCallback(
    (page: number) => {
      if (page < 1 || page > allPageEntries.length) return `Page ${page}`;
      return allPageEntries[page - 1]?.name || `Page ${page}`;
    },
    [allPageEntries]
  );

  const getTextPage = useCallback(
    (textPageId: string): DocumentTextPage | undefined => {
      return textPages.find((tp) => tp.id === textPageId);
    },
    [textPages]
  );

  return {
    document,
    // pdfUrl: populated in legacy fallback mode only; null when per-page is active
    pdfUrl,
    // pageUrls: populated when document_pages rows exist (primary path)
    pageUrls,
    numPages: pageMap.totalPages || pdfPageCount,
    pdfPageCount,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries: allPageEntries,
    branding,
    brandingLoaded,
    textPages,
    isTocPage: pageMap.isTocPage,
    isTextPage: pageMap.isTextPage,
    getTextPageId: pageMap.getTextPageId,
    toPdfPage: pageMap.toPdfPage,
    tocSettings,
    pageSequence: pageMap.pageSequence,
    getTextPage,
    onDocumentLoadSuccess,
    getPageName,
  };
}

export { deriveBorderColor };