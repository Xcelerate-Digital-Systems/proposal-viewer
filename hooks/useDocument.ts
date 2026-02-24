// hooks/useDocument.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Document as DocType, PageNameEntry, normalizePageNames } from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor } from '@/hooks/useProposal';

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
}

/* ─── Special page: represents a non-PDF page in the virtual sequence ── */

interface SpecialPage {
  type: 'text';
  position: number;      // -1 = end, N = after PDF page N
  title: string;
  textPageId: string;
  sortOrder: number;
}

/**
 * Virtual page mapping for documents (text pages only, no pricing).
 */
function buildDocumentPageMap(
  pdfPageCount: number,
  textPages: DocumentTextPage[]
) {
  const specials: SpecialPage[] = [];

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
      pageSequence: [] as Array<{ type: 'pdf'; pdfPage: number } | { type: 'text'; textPageId: string }>,
      isTextPage: (_vp: number) => false,
      getTextPageId: (_vp: number): string | null => null,
      toPdfPage: (vp: number) => vp,
    };
  }

  type VirtualPage =
    | { type: 'pdf'; pdfPage: number }
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
      sequence.push({ type: 'text', textPageId: sp.textPageId });
      posIdx++;
    }
    sequence.push({ type: 'pdf', pdfPage });
  }

  while (posIdx < positioned.length) {
    const sp = positioned[posIdx];
    sequence.push({ type: 'text', textPageId: sp.textPageId });
    posIdx++;
  }

  trailing.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailing) {
    sequence.push({ type: 'text', textPageId: sp.textPageId });
  }

  const totalPages = sequence.length;

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
    isTextPage,
    getTextPageId,
    toPdfPage,
  };
}

export function useDocument(token: string) {
  const [document, setDocument] = useState<DocType | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [textPages, setTextPages] = useState<DocumentTextPage[]>([]);

  // Fetch document + branding + text pages
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
        const res = await fetch(`/api/company/branding?domain=${hostname}&company_id=${doc.company_id}`);
        if (res.ok) {
          const data = await res.json();
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

      // 4. Generate signed URL for PDF
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(doc.file_path, 3600);

      if (urlData?.signedUrl) {
        setPdfUrl(urlData.signedUrl);
      }

      setLoading(false);
    })();
  }, [token]);

  // Normalize page names from document
  const pageEntries: PageNameEntry[] = useMemo(() => {
    if (!document) return [];
    return normalizePageNames(document.page_names, pdfPageCount);
  }, [document, pdfPageCount]);

  // Build virtual page map
  const pageMap = useMemo(
    () => buildDocumentPageMap(pdfPageCount, textPages),
    [pdfPageCount, textPages]
  );

  // Build page entries with text pages interleaved for sidebar
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
      } else {
        const tp = textPages.find((t) => t.id === seqEntry.textPageId);
        result.push({ name: tp?.title || 'Text Page', indent: 0 });
      }
    }

    result.push(...trailingGroups);

    return result;
  }, [pageEntries, pdfPageCount, textPages, pageMap.pageSequence]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setPdfPageCount(n);
  }, []);

  const getPageName = useCallback(
    (page: number) => {
      if (page < 1 || page > allPageEntries.length) return `Page ${page}`;
      return allPageEntries[page - 1]?.name || `Page ${page}`;
    },
    [allPageEntries]
  );

  // Get a text page by its ID
  const getTextPage = useCallback((textPageId: string): DocumentTextPage | undefined => {
    return textPages.find((tp) => tp.id === textPageId);
  }, [textPages]);

  return {
    document,
    pdfUrl,
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
    isTextPage: pageMap.isTextPage,
    getTextPageId: pageMap.getTextPageId,
    toPdfPage: pageMap.toPdfPage,
    getTextPage,
    onDocumentLoadSuccess,
    getPageName,
  };
}

export { deriveBorderColor };