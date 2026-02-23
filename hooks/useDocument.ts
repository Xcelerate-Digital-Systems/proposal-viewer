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

export function useDocument(token: string) {
  const [document, setDocument] = useState<DocType | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  // Fetch document + branding
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

      // 3. Generate signed URL for PDF
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(doc.file_path, 3600);

      if (urlData?.signedUrl) {
        setPdfUrl(urlData.signedUrl);
      }

      setLoading(false);
    })();
  }, [token]);

  // Normalize page names
  const pageEntries: PageNameEntry[] = useMemo(() => {
    if (!document) return [];
    return normalizePageNames(document.page_names, numPages);
  }, [document, numPages]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  const getPageName = useCallback(
    (page: number) => {
      if (page < 1 || page > pageEntries.length) return `Page ${page}`;
      return pageEntries[page - 1]?.name || `Page ${page}`;
    },
    [pageEntries]
  );

  return {
    document,
    pdfUrl,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    branding,
    brandingLoaded,
    onDocumentLoadSuccess,
    getPageName,
  };
}

export { deriveBorderColor };