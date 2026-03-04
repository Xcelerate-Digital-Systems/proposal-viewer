// app/doc/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileText, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import Sidebar from '@/components/viewer/Sidebar';
import { useDocument, deriveBorderColor } from '@/hooks/useDocument';
import CoverPage from '@/components/viewer/CoverPage';
import PdfViewer from '@/components/viewer/PdfViewer';
import TextPage from '@/components/viewer/TextPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { exportCompositePdf } from '@/lib/compositeExport';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import ViewerBackground from '@/components/viewer/ViewerBackground';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';


/* ─── Document Viewer Page ────────────────────────────────────────── */

export default function DocumentViewerPage({ params }: { params: { token: string } }) {
  const {
    document: doc,
    pdfUrl,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    branding,
    brandingLoaded,
    textPages,
    isTextPage,
    getTextPageId,
    getTextPage,
    toPdfPage,
    onDocumentLoadSuccess,
    getPageName,
  } = useDocument(params.token);

  const [showCover, setShowCover] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Is the current virtual page a text page?
  const onTextPage = isTextPage(currentPage);
  const currentTextPageId = getTextPageId(currentPage);
  const currentTextPage = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  // If not a text page, what PDF page should we show?
  const pdfPage = toPdfPage(currentPage);

  // Get link for current page (skip group entries to find Nth actual page)
  const currentPageLink = useMemo(() => {
    let count = 0;
    for (const entry of pageEntries) {
      if (entry.type === 'group') continue;
      count++;
      if (count === currentPage) {
        return entry.link_url ? { url: entry.link_url, label: entry.link_label } : null;
      }
    }
    return null;
  }, [pageEntries, currentPage]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  // Dismiss cover state when cover isn't enabled so keyboard nav works
  useEffect(() => {
    if (doc && !doc.cover_enabled) {
      setShowCover(false);
    }
  }, [doc]);

  // Keyboard navigation
  useEffect(() => {
    if (showCover) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (currentPage < numPages) goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentPage > 1) goToPage(currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(numPages);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, goToPage, showCover]);

  // Update browser tab title
  useEffect(() => {
    if (doc) {
      document.title = doc.title;
    }
    return () => { document.title = 'Document Viewer'; };
  }, [doc]);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';

  // ── Composite PDF download (includes text pages) ───────────────────
  const hasSpecialPages = textPages.length > 0;
  const noPricing = useCallback(() => false, []);

  const handleCompositeDownload = useCallback(async () => {
    if (!pdfUrl) throw new Error('No PDF URL available');
    // Build text page orientation map
    const entityOrientation = doc?.page_orientation || 'auto';
    const textPageOrientations: Record<string, 'auto' | 'portrait' | 'landscape'> = Object.fromEntries(
      textPages.map(tp => [tp.id, entityOrientation])
    );
    return exportCompositePdf({
      pdfUrl,
      title: doc?.title || 'document',
      numPages,
      isPricingPage: noPricing,
      isTextPage,
      getTextPageId,
      toPdfPage,
      getTextPage,
      pricing: null,
      branding,
      companyName: branding.name,
      proposalTitle: doc?.title,
      textPageOrientations,
      isPackagesPage: () => false,
      packages: null,
      proposal: null,
      includeCover: false,
    });
  }, [pdfUrl, doc, numPages, noPricing, isTextPage, getTextPageId, toPdfPage, getTextPage, branding, textPages]);

  // ── Early returns AFTER all hooks ──────────────────────────────────

  if (!brandingLoaded) {
    return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (loading) {
    return <ViewerLoader branding={branding} loading={true} label="Loading document…" />;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: bgSecondary }}
          >
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Document Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  // Cover page — build a Proposal-compatible object for the shared CoverPage component
  if (showCover && doc?.cover_enabled) {
    const coverCompat = {
      ...doc,
      client_name: '',
      cover_subtitle: doc.cover_subtitle || doc.description || doc.title,
      cover_button_text: doc.cover_button_text || 'START READING',
      accept_button_text: null,
      status: 'sent' as const,
      cover_date: doc.cover_date || null,
      cover_show_date: doc.cover_show_date ?? false,
      cover_show_prepared_by: false,
      cover_show_client_logo: false,
      cover_show_avatar: false,
      cover_client_logo_path: null,
      cover_avatar_path: null,
    };

    return (
      <>
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CoverPage proposal={coverCompat as any} branding={branding} onStart={() => setShowCover(false)} />
      </>
    );
  }

  return (
    <div
      className="flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: bgPrimary, height: '100dvh' }}
    >
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Mobile header */}
      <div
        className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b shrink-0 z-20"
        style={{ backgroundColor: bgSecondary, borderColor: border }}
      >
        <button
          onClick={() => setMobileSidebar(true)}
          className="p-2 transition-opacity hover:opacity-70 rounded-lg"
          style={{ color: sidebarText }}
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 min-w-0 mx-1 flex items-center justify-center gap-1">
          <button
            onClick={() => currentPage > 1 && goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg transition-opacity disabled:opacity-20"
            style={{ color: sidebarText }}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs truncate px-1" style={{ color: sidebarText, opacity: 0.55 }}>
            {getPageName(currentPage)}
            {numPages > 0 && ` · ${currentPage}/${numPages}`}
          </span>
          <button
            onClick={() => currentPage < numPages && goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded-lg transition-opacity disabled:opacity-20"
            style={{ color: sidebarText }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="w-10" /> {/* spacer for symmetry */}
      </div>

      {/* Sidebar — shared component, no accept/comments for documents */}
      <Sidebar
        numPages={numPages}
        currentPage={currentPage}
        pageEntries={pageEntries}
        getPageName={getPageName}
        onPageSelect={goToPage}
        branding={branding}
        mobileOpen={mobileSidebar}
        onMobileClose={() => setMobileSidebar(false)}
      />

      {/* Main content — PDF viewer */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Pop-down link bar */}
        {currentPageLink && (
          <PageLinkButton
            url={currentPageLink.url}
            label={currentPageLink.label}
            accentColor={accent}
          />
        )}
        {/* Conditionally render Text page or PDF */}
        {onTextPage && currentTextPage ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto relative"
            style={{ backgroundColor: bgPrimary }}
          >
            <ViewerBackground branding={branding} />
            <div className="relative">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TextPage
                textPage={currentTextPage as any}
                branding={branding}
                companyName={branding.name}
                proposalTitle={doc?.title}
              />
            </div>
          </div>
        ) : (
          <PdfViewer
            pdfUrl={pdfUrl}
            currentPage={pdfPage}
            onLoadSuccess={onDocumentLoadSuccess}
            scrollRef={mainRef}
            bgColor={bgPrimary}
            accentColor={accent}
            branding={branding}
          />
        )}
        <PageNumberBadge
          currentPage={currentPage}
          totalPages={numPages}
          accentColor={accent}
        />
        <FloatingToolbar
          pdfUrl={pdfUrl}
          title={doc?.title || ''}
          currentPage={currentPage}
          numPages={numPages}
          onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
          onNextPage={() => goToPage(Math.min(numPages, currentPage + 1))}
          bgColor={bgSecondary}
          borderColor={border}
          accentColor={accent}
          onCompositeDownload={hasSpecialPages && pdfUrl ? handleCompositeDownload : undefined}
        />
      </div>
    </div>
  );
}