// app/template-preview/[id]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Menu, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import { deriveBorderColor } from '@/hooks/useProposal';
import { useTemplatePreview } from '@/hooks/useTemplatePreview';
import CoverPage from '@/components/viewer/CoverPage';
import Sidebar from '@/components/viewer/Sidebar';
import TemplatePdfViewer from '@/components/viewer/TemplatePdfViewer';
import PricingPage from '@/components/viewer/PricingPage';
import TextPage from '@/components/viewer/TextPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

export default function TemplatePreviewPage({ params }: { params: { id: string } }) {
  const {
    template,
    pageUrls,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    branding,
    brandingLoaded,
    pricing,
    isPricingPage,
    isTextPage,
    getTextPageId,
    getTextPage,
    toPdfPage,
    getPageName,
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

  if (loading) {
    return <ViewerLoader branding={branding} loading={true} label="Loading template preview…" />;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: bgSecondary }}>
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Template Not Found</h2>
          <p className="text-[#666] text-sm">This template may have been removed.</p>
        </div>
      </div>
    );
  }

  // Build a proposal-compatible object for the CoverPage component
  if (showCover && template?.cover_enabled) {
    const coverCompat = {
      ...template,
      title: template.name,
      client_name: '[Client Name]',
      cover_subtitle: template.cover_subtitle || 'Prepared for [Client Name]',
      cover_button_text: template.cover_button_text || 'START READING PROPOSAL',
      prepared_by: template.prepared_by || null,
      accept_button_text: null,
      status: 'sent' as const,
      share_token: '',
      file_path: '',
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

      {/* Template Preview Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-xs font-medium"
        style={{ backgroundColor: '#017C87', color: '#ffffff' }}
      >
        <div className="flex items-center gap-2">
          <a
            href="/templates"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={12} />
            Back
          </a>
          <span>Template Preview: <strong>{template?.name}</strong></span>
        </div>
        <span className="opacity-70">This is a preview — placeholder data is shown for client fields</span>
      </div>

      {/* Mobile header bar */}
      <div
        className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b shrink-0 z-20 mt-9"
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
      </div>

      {/* Sidebar — no accept button or comments for template preview */}
      <div className="hidden lg:block mt-9">
        <Sidebar
          numPages={numPages}
          currentPage={currentPage}
          pageEntries={pageEntries}
          getPageName={getPageName}
          onPageSelect={goToPage}
          accepted={false}
          onAcceptClick={() => {}}
          showComments={false}
          onToggleComments={() => {}}
          commentCount={0}
          branding={branding}
          mobileOpen={mobileSidebar}
          onMobileClose={() => setMobileSidebar(false)}
        />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileSidebar && (
        <div className="lg:hidden">
          <Sidebar
            numPages={numPages}
            currentPage={currentPage}
            pageEntries={pageEntries}
            getPageName={getPageName}
            onPageSelect={goToPage}
            accepted={false}
            onAcceptClick={() => {}}
            showComments={false}
            onToggleComments={() => {}}
            commentCount={0}
            branding={branding}
            mobileOpen={mobileSidebar}
            onMobileClose={() => setMobileSidebar(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative lg:mt-9">
        {/* Conditionally render PDF, Pricing, or Text page */}
        {onPricingPage && pricing ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto"
            style={{ backgroundColor: bgPrimary }}
          >
            <PricingPage
              pricing={pricing}
              branding={branding}
              clientName="[Client Name]"
            />
          </div>
        ) : onTextPage && currentTextPage ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto"
            style={{ backgroundColor: bgPrimary }}
          >
            <TextPage
              textPage={currentTextPage}
              branding={branding}
              clientName="[Client Name]"
              companyName={branding.name}
              proposalTitle={template?.name}
            />
          </div>
        ) : (
          <TemplatePdfViewer
            pageUrls={pageUrls}
            currentPdfPage={pdfPage}
            scrollRef={mainRef}
            bgColor={bgPrimary}
            accentColor={accent}
          />
        )}

        <FloatingToolbar
          pdfUrl={pageUrls[pdfPage] || null}
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
    </div>
  );
}