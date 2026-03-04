// app/template-preview/[id]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import { deriveBorderColor } from '@/hooks/useProposal';
import { useTemplatePreview } from '@/hooks/useTemplatePreview';
import CoverPage from '@/components/viewer/CoverPage';
import Sidebar from '@/components/viewer/Sidebar';
import PdfViewer from '@/components/viewer/PdfViewer';
import PricingPage from '@/components/viewer/PricingPage';
import PackagesPage from '@/components/viewer/PackagesPage';
import TextPage from '@/components/viewer/TextPage';
import TocPage from '@/components/viewer/TocPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import ViewerBackground from '@/components/viewer/ViewerBackground';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';


export default function TemplatePreviewPage({ params }: { params: { id: string } }) {
  const {
    template,
    pdfUrl,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    branding,
    brandingLoaded,
    pricing,
    packages,
    isPricingPage,
    isPackagesPage,
    isTocPage,
    isTextPage,
    getTextPageId,
    getTextPage,
    toPdfPage,
    tocSettings,
    pageSequence,
    getPageName,
    onDocumentLoadSuccess,
  } = useTemplatePreview(params.id);

  const [showCover, setShowCover] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  // Current page state
  const onPricingPage = isPricingPage(currentPage);
  const onPackagesPage = isPackagesPage(currentPage);
  const onTocPage = isTocPage(currentPage);
  const onTextPage = isTextPage(currentPage);
  const currentTextPageId = getTextPageId(currentPage);
  const currentTextPage = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  const pdfPage = toPdfPage(currentPage);

  // Dismiss cover state when cover isn't enabled
  useEffect(() => {
    if (template && !template.cover_enabled) {
      setShowCover(false);
    }
  }, [template]);

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
    if (template) {
      document.title = `Preview: ${template.name}`;
    }
    return () => { document.title = 'Template Preview'; };
  }, [template]);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#fff';

  // ── Early returns AFTER all hooks ──────────────────────────────────

  if (!brandingLoaded) {
    return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  // NOTE: removed the `if (loading)` early return — ViewerLoader is now
  // rendered as a sibling overlay so it stays mounted across the
  // loading → loaded transition and can animate 85% → 100% → fade out.

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
          <h2 className="text-xl font-semibold text-white mb-2">Template Not Found</h2>
          <p className="text-[#666] text-sm">This template may have been deleted.</p>
        </div>
      </div>
    );
  }

  // Cover page
  if (showCover && template?.cover_enabled) {
    const coverCompat = {
      ...template,
      client_name: '[Client Name]',
      cover_subtitle: template.cover_subtitle || template.description || template.name,
      cover_button_text: template.cover_button_text || 'VIEW TEMPLATE',
      accept_button_text: null,
      status: 'sent' as const,
      cover_date: template.cover_date || null,
      cover_show_date: template.cover_show_date ?? false,
      cover_show_avatar: template.cover_show_avatar ?? false,
      cover_show_prepared_by: template.cover_show_prepared_by ?? true,
    };

    return (
      <>
        {/* Loader overlay — stays mounted so it animates 85% → 100% → fade */}
        <ViewerLoader branding={branding} loading={loading} label="Loading template preview…" />
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />
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
      {/* Loader overlay — stays mounted so it animates 85% → 100% → fade */}
      <ViewerLoader branding={branding} loading={loading} label="Loading template preview…" />
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />

      {!loading && template && (<>
      {/* Mobile header bar */}
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
            className="p-1.5 rounded disabled:opacity-30"
            style={{ color: sidebarText }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium truncate" style={{ color: `${sidebarText}b3` }}>
            {getPageName(currentPage)}
          </span>
          <button
            onClick={() => currentPage < numPages && goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded disabled:opacity-30"
            style={{ color: sidebarText }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="w-10" />
      </div>

      {/* Sidebar — direct flex child, identical to proposal viewer */}
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Conditionally render PDF, Pricing, Packages, TOC, or Text page */}
        {onPricingPage && pricing ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto relative"
            style={{ backgroundColor: bgPrimary }}
          >
            <ViewerBackground branding={branding} />
            <div className="relative h-full">
              <PricingPage
                pricing={pricing}
                branding={branding}
                clientName="[Client Name]"
              />
            </div>
          </div>
        ) : onPackagesPage && packages ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto relative"
            style={{ backgroundColor: bgPrimary }}
          >
            <ViewerBackground branding={branding} />
            <div className="relative h-full">
              <PackagesPage
                packages={packages}
                branding={branding}
                clientName="[Client Name]"
              />
            </div>
          </div>
        ) : onTocPage && tocSettings ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto relative"
            style={{ backgroundColor: bgPrimary }}
          >
            <ViewerBackground branding={branding} />
            <div className="relative h-full">
              <TocPage
                branding={branding}
                tocSettings={tocSettings}
                pageSequence={pageSequence}
                pageEntries={pageEntries}
                numPages={numPages}
              />
            </div>
          </div>
        ) : onTextPage && currentTextPage ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto relative"
            style={{ backgroundColor: bgPrimary }}
          >
            <ViewerBackground branding={branding} />
            <div className="relative h-full">
              <TextPage
                textPage={currentTextPage}
                branding={branding}
                clientName="[Client Name]"
                companyName={branding.name}
                proposalTitle={template?.name}
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
          title={template?.name || ''}
          currentPage={currentPage}
          numPages={numPages}
          onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
          onNextPage={() => goToPage(Math.min(numPages, currentPage + 1))}
          bgColor={bgSecondary}
          borderColor={border}
          accentColor={accent}
        />
      </div>
      </>)}
    </div>
  );
}