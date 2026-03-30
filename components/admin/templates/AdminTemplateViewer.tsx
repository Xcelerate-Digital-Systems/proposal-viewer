// components/admin/templates/AdminTemplateViewer.tsx
// Full client-facing template viewer inside the admin panel with edit overlays.
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Menu, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import Sidebar from '@/components/viewer/Sidebar';
import CoverPage from '@/components/viewer/CoverPage';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import PdfViewer from '@/components/viewer/PdfViewer';
import PricingPage from '@/components/viewer/PricingPage';
import PackagesPage from '@/components/viewer/PackagesPage';
import TextPage from '@/components/viewer/TextPage';
import TocPage from '@/components/viewer/TocPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';
import ViewerBackground from '@/components/viewer/ViewerBackground';
import { useTemplatePreview } from '@/hooks/useTemplatePreview';
import { deriveBorderColor } from '@/hooks/useProposal';
import { supabase } from '@/lib/supabase';
import type { ProposalPricing, ProposalPackages } from '@/lib/supabase';
import TemplateSectionEditorPanel, { type TemplateActiveSection } from './TemplateSectionEditorPanel';

interface AdminTemplateViewerProps {
  templateId: string;
  onExit: () => void;
}

export default function AdminTemplateViewer({ templateId, onExit }: AdminTemplateViewerProps) {
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
    pricingPages,
    getPricingId,
    packages,
    isPricingPage,
    isPackagesPage,
    getPackagesId,
    isTocPage,
    isTextPage,
    getTextPageId,
    getTextPage,
    toPdfPage,
    pageUrls,
    tocSettings,
    pageSequence,
    getPageName,
    onDocumentLoadSuccess,
  } = useTemplatePreview(templateId);

  const [showCover, setShowCover] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activeSection, setActiveSection] = useState<TemplateActiveSection | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | undefined>(undefined);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!template?.cover_client_logo_path) { setClientLogoUrl(undefined); return; }
    supabase.storage.from('proposals').createSignedUrl(template.cover_client_logo_path, 3600)
      .then(({ data }) => setClientLogoUrl(data?.signedUrl || undefined));
  }, [template?.cover_client_logo_path]);

  const onPricingPage = isPricingPage(currentPage);
  const onPackagesPage = isPackagesPage(currentPage);
  const onTocPage = isTocPage(currentPage);
  const onTextPage = isTextPage(currentPage);
  const currentPricingId = getPricingId(currentPage);
  const currentPricing = currentPricingId
    ? pricingPages.find((p: Record<string, unknown>) => p.id === currentPricingId)
    : null;
  const currentPackagesId = getPackagesId(currentPage);
  const currentPackages = currentPackagesId ? packages.find((p) => p.id === currentPackagesId) : undefined;
  const currentTextPageId = getTextPageId(currentPage);
  const currentTextPage = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  const isSectionPage = pageUrls[currentPage - 1]?.type === 'section';
  const isEditable = onPricingPage || onPackagesPage || onTextPage;

  const currentPageLink = useMemo(() => {
    const entry = pageUrls[currentPage - 1];
    return entry?.link_url ? { url: entry.link_url, label: entry.link_label ?? undefined } : null;
  }, [pageUrls, currentPage]);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#01434A';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';
  const pageOrientation = template?.page_orientation === 'landscape' ? 'landscape' as const : 'portrait' as const;

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
    if (template && !template.cover_enabled) setShowCover(false);
  }, [template]);

  const handleEditClick = () => {
    if (onPricingPage) {
      setActiveSection({ type: 'pricing' });
    } else if (onPackagesPage && currentPackagesId) {
      setActiveSection({ type: 'packages', pageId: currentPackagesId });
    } else if (onTextPage && currentTextPageId) {
      setActiveSection({ type: 'text', pageId: currentTextPageId });
    }
  };

  /* ── Loading/error states ────────────────────────────────────────── */

  if (!brandingLoaded) {
    return <div className="h-full w-full" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (loading) {
    return <ViewerLoader branding={branding} loading={true} label="Loading template…" />;
  }

  if (notFound) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <p className="text-white text-sm">Template not found.</p>
      </div>
    );
  }

  /* ── Cover page ──────────────────────────────────────────────────── */

  if (showCover && template?.cover_enabled) {
    const coverCompat = {
      ...template,
      title: template.name,
      client_name: '[Client Name]',
      cover_subtitle: template.cover_subtitle || null,
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
            {isEditable ? '— click "Edit Section" to edit this page' : '— navigate to a Pricing, Packages, or Text page to edit'}
          </span>
        </div>
        <button onClick={onExit} className="flex items-center gap-1.5 text-xs font-medium text-teal/70 hover:text-teal transition-colors">
          <X size={13} />
          Exit
        </button>
      </div>

      {/* Viewer */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: bgPrimary }}>
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b shrink-0 z-20" style={{ backgroundColor: bgSecondary, borderColor: border }}>
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
              onClick={handleEditClick}
              className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all ${
                activeSection ? 'bg-teal text-white' : 'bg-white text-teal border border-teal/30 hover:bg-teal hover:text-white'
              }`}
            >
              <Pencil size={13} />
              {activeSection ? 'Editing' : 'Edit Section'}
            </button>
          )}

          {/* Page content */}
          {onPricingPage && (currentPricing || pricing) ? (
            <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
              <ViewerBackground branding={branding} />
              <div ref={mainRef} className="absolute inset-0 overflow-auto">
                <div className="relative min-h-full">
                  <PricingPage pricing={(currentPricing ?? pricing) as unknown as ProposalPricing} branding={branding} clientName="[Client Name]" orientation={pageOrientation} />
                </div>
              </div>
            </div>
          ) : onPackagesPage && currentPackages ? (
            <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
              <ViewerBackground branding={branding} />
              <div ref={mainRef} className="absolute inset-0 overflow-auto">
                <div className="relative min-h-full">
                  <PackagesPage packages={currentPackages as unknown as ProposalPackages} branding={branding} clientName="[Client Name]" orientation={pageOrientation} />
                </div>
              </div>
            </div>
          ) : onTocPage && tocSettings ? (
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
                  <TextPage textPage={currentTextPage} branding={branding} clientName="[Client Name]" companyName={branding.name} proposalTitle={template?.name} orientation={pageOrientation} clientLogoUrl={clientLogoUrl} />
                </div>
              </div>
            </div>
          ) : (
            <PdfViewer pdfUrl={pdfUrl} currentPage={toPdfPage(currentPage)} onLoadSuccess={onDocumentLoadSuccess} scrollRef={mainRef} bgColor={bgPrimary} accentColor={accent} branding={branding} pageUrls={pageUrls.filter((p) => p.type === 'pdf')} />
          )}

          <PageNumberBadge currentPage={currentPage} totalPages={numPages} accentColor={accent} circleColor={branding.page_num_circle_color ?? undefined} textColor={branding.page_num_text_color ?? undefined} font={branding.font_body} />

          <FloatingToolbar
            pdfUrl={pdfUrl}
            title={template?.name || ''}
            currentPage={currentPage}
            numPages={numPages}
            onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
            onNextPage={() => goToPage(Math.min(pageUrls.length, currentPage + 1))}
            bgColor={bgSecondary}
            borderColor={border}
            accentColor={accent}
          />

          {/* Bottom-sheet section editor */}
          {activeSection && template && (
            <TemplateSectionEditorPanel
              templateId={templateId}
              companyId={template.company_id}
              section={activeSection}
              onClose={() => setActiveSection(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
