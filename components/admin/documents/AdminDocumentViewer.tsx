// components/admin/documents/AdminDocumentViewer.tsx
// Full client-facing document viewer inside the admin panel with edit overlays.
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Menu, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import Sidebar from '@/components/viewer/Sidebar';
import CoverPage from '@/components/viewer/CoverPage';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import PdfViewer from '@/components/viewer/PdfViewer';
import TextPage from '@/components/viewer/TextPage';
import TocPage from '@/components/viewer/TocPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';
import ViewerBackground from '@/components/viewer/ViewerBackground';
import { useDocument, deriveBorderColor } from '@/hooks/useDocument';
import SectionEditorPanel from '@/components/admin/proposals/SectionEditorPanel';
import type { ActiveSection } from '@/components/admin/proposals/SectionEditorPanel';

interface AdminDocumentViewerProps {
  documentId: string;
  shareToken: string;
  onExit: () => void;
}

export default function AdminDocumentViewer({ documentId, shareToken, onExit }: AdminDocumentViewerProps) {
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
    isTocPage,
    isTextPage,
    getTextPageId,
    getTextPage,
    toPdfPage,
    tocSettings,
    pageSequence,
    onDocumentLoadSuccess,
    pageUrls,
    getPageName,
  } = useDocument(shareToken);

  const [showCover, setShowCover] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const onTocPage = isTocPage(currentPage);
  const onTextPage = isTextPage(currentPage);
  const currentTextPageId = getTextPageId(currentPage);
  const currentTextPage = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  const pdfPage = toPdfPage(currentPage);
  const isSectionPage = pageUrls[currentPage - 1]?.type === 'section';
  const isEditable = onTextPage;

  const currentPageLink = useMemo(() => {
    const entry = pageUrls[currentPage - 1];
    return entry?.link_url ? { url: entry.link_url, label: entry.link_label ?? undefined } : null;
  }, [pageUrls, currentPage]);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#01434A';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';
  const pageOrientation = doc?.page_orientation === 'landscape' ? 'landscape' as const : 'portrait' as const;

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    setActiveSection(null);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  useEffect(() => {
    if (isSectionPage && pageUrls.length > 0) {
      const next = currentPage < pageUrls.length ? currentPage + 1 : currentPage - 1;
      goToPage(next);
    }
  }, [isSectionPage, currentPage, pageUrls.length, goToPage]);

  useEffect(() => {
    if (doc && !doc.cover_enabled) setShowCover(false);
  }, [doc]);

  /* ── Loading/error states ────────────────────────────────────────── */

  if (!brandingLoaded) {
    return <div className="h-full w-full" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (loading) {
    return <ViewerLoader branding={branding} loading={true} label="Loading document…" />;
  }

  if (notFound) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <p className="text-white text-sm">Document not found.</p>
      </div>
    );
  }

  /* ── Cover page ──────────────────────────────────────────────────── */

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
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CoverPage proposal={coverCompat as any} branding={branding} onStart={() => setShowCover(false)} />
      </>
    );
  }

  /* ── Main viewer ─────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Admin edit-mode bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-teal/10 border-b border-teal/20 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-teal uppercase tracking-wide">Edit in Preview</span>
          <span className="text-xs text-teal/60">
            {isEditable ? '— click "Edit Section" to edit this page' : '— navigate to a Text page to edit'}
          </span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-medium text-teal/70 hover:text-teal transition-colors"
        >
          <X size={13} />
          Exit
        </button>
      </div>

      {/* Viewer */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: bgPrimary }}>
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />

        {/* Mobile header */}
        <div
          className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b shrink-0 z-20"
          style={{ backgroundColor: bgSecondary, borderColor: border }}
        >
          <button onClick={() => setMobileSidebar(true)} className="p-2 transition-opacity hover:opacity-70 rounded-lg" style={{ color: sidebarText }}>
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0 mx-1 flex items-center justify-center gap-1">
            <button onClick={() => currentPage > 1 && goToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg transition-opacity disabled:opacity-20" style={{ color: sidebarText }}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs truncate px-1" style={{ color: sidebarText, opacity: 0.55 }}>
              {getPageName(currentPage)}{numPages > 0 && ` · ${currentPage}/${numPages}`}
            </span>
            <button onClick={() => currentPage < pageUrls.length && goToPage(currentPage + 1)} disabled={currentPage >= pageUrls.length} className="p-1.5 rounded-lg transition-opacity disabled:opacity-20" style={{ color: sidebarText }}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="w-10" />
        </div>

        {/* Branded sidebar */}
        <Sidebar
          numPages={numPages}
          currentPage={currentPage}
          pageEntries={pageEntries}
          getPageName={getPageName}
          onPageSelect={(page) => { goToPage(page); setActiveSection(null); }}
          branding={branding}
          mobileOpen={mobileSidebar}
          onMobileClose={() => setMobileSidebar(false)}
          showComments={false}
          onToggleComments={() => {}}
          commentCount={0}
        />

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          {currentPageLink && (
            <PageLinkButton url={currentPageLink.url} label={currentPageLink.label} accentColor={accent} />
          )}

          {/* Edit Section button */}
          {isEditable && (
            <button
              onClick={() => setActiveSection({ type: 'text', pageId: currentTextPageId! })}
              className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all ${
                activeSection ? 'bg-teal text-white' : 'bg-white text-teal border border-teal/30 hover:bg-teal hover:text-white'
              }`}
            >
              <Pencil size={13} />
              {activeSection ? 'Editing' : 'Edit Section'}
            </button>
          )}

          {/* Page content */}
          {onTocPage && tocSettings ? (
            <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
              <ViewerBackground branding={branding} />
              <div ref={mainRef} className="absolute inset-0 overflow-auto">
                <div className="relative min-h-full">
                  <TocPage branding={branding} tocSettings={tocSettings} pageSequence={pageSequence} pageEntries={pageEntries} numPages={numPages} orientation={pageOrientation} />
                </div>
              </div>
            </div>
          ) : onTextPage && currentTextPage ? (
            <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
              <ViewerBackground branding={branding} />
              <div ref={mainRef} className="absolute inset-0 overflow-auto">
                <div className="relative min-h-full">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <TextPage textPage={currentTextPage as any} branding={branding} companyName={branding.name} proposalTitle={doc?.title} orientation={pageOrientation} />
                </div>
              </div>
            </div>
          ) : (
            <PdfViewer pdfUrl={pdfUrl} currentPage={pdfPage} onLoadSuccess={onDocumentLoadSuccess} scrollRef={mainRef} bgColor={bgPrimary} accentColor={accent} branding={branding} pageUrls={pageUrls.filter((p) => p.type === 'pdf')} />
          )}

          <PageNumberBadge currentPage={currentPage} totalPages={numPages} accentColor={accent} circleColor={branding.page_num_circle_color ?? undefined} textColor={branding.page_num_text_color ?? undefined} font={branding.font_body} />

          <FloatingToolbar
            pdfUrl={pdfUrl}
            title={doc?.title || ''}
            currentPage={currentPage}
            numPages={numPages}
            onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
            onNextPage={() => goToPage(Math.min(pageUrls.length, currentPage + 1))}
            bgColor={bgSecondary}
            borderColor={border}
            accentColor={accent}
            onCompositeDownload={textPages.length > 0 && (pdfUrl || pageUrls.length > 0) ? undefined : undefined}
          />

          {/* Bottom-sheet section editor */}
          {activeSection && (
            <SectionEditorPanel
              proposalId={documentId}
              section={activeSection}
              onClose={() => setActiveSection(null)}
              onSaved={() => {}}
              tabBaseHref={`/documents/${documentId}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
