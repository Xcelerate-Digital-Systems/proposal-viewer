// app/view/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileText, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import Sidebar from '@/components/viewer/Sidebar';
import { useProposal, deriveBorderColor } from '@/hooks/useProposal';
import CoverPage from '@/components/viewer/CoverPage';
import PdfViewer from '@/components/viewer/PdfViewer';
import TextPage from '@/components/viewer/TextPage';
import TocPage from '@/components/viewer/TocPage';
import PricingPage from '@/components/viewer/PricingPage';
import PackagesPage from '@/components/viewer/PackagesPage';
import AcceptModal from '@/components/viewer/AcceptModal';
import CommentsPanel from '@/components/viewer/CommentsPanel';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import ViewerBackground from '@/components/viewer/ViewerBackground';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';
import { ProposalPricing, ProposalPackages, supabase } from '@/lib/supabase';

/* ─── Proposal Viewer Page ────────────────────────────────────────── */

export default function ProposalViewerPage({ params }: { params: { token: string } }) {
  const {
    proposal,
    pdfUrl,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    branding,
    brandingLoaded,
    comments,
    accepted,
    pricing,
    packages,
    textPages,
    isPricingPage,
    isPackagesPage,
    isTocPage,
    isTextPage,
    getPackagesId,
    getTextPageId,
    getTextPage,
    toPdfPage,
    tocSettings,
    pageSequence,
    onDocumentLoadSuccess,
    pageUrls,
    getPageName,
    acceptProposal,
    submitComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  } = useProposal(params.token);

  const [showCover, setShowCover] = useState(true);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Virtual page type checks for current page
  const onTocPage      = isTocPage(currentPage);
  const onTextPage     = isTextPage(currentPage);
  const onPricingPage  = isPricingPage(currentPage);
  const onPackagesPage = isPackagesPage(currentPage);

  const currentTextPageId  = getTextPageId(currentPage);
  const currentTextPage    = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  const currentPackagesId  = getPackagesId(currentPage);
  const currentPackages    = currentPackagesId
    ? packages.find((p: Record<string, unknown>) => p.id === currentPackagesId)
    : null;

  // PDF page index (only meaningful for pdf-type pages)
  const pdfPage = toPdfPage(currentPage);

  // Per-page link
  const isSectionPage = pageUrls[currentPage - 1]?.type === 'section';
  const currentPageLink = useMemo(() => {
    const entry = pageUrls[currentPage - 1];
    return entry?.link_url ? { url: entry.link_url, label: entry.link_label ?? undefined } : null;
  }, [pageUrls, currentPage]);

  useEffect(() => {
    if (!proposal?.cover_client_logo_path) return;
    const { data } = supabase.storage
      .from('proposals')
      .getPublicUrl(proposal.cover_client_logo_path);
    if (data?.publicUrl) setClientLogoUrl(data.publicUrl);
  }, [proposal?.cover_client_logo_path]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  // Auto-skip section pages
  useEffect(() => {
    if (isSectionPage && numPages > 0) {
      const next = currentPage < numPages ? currentPage + 1 : currentPage - 1;
      goToPage(next);
    }
  }, [isSectionPage, currentPage, numPages, goToPage]);

  // Dismiss cover when not enabled
  useEffect(() => {
    if (proposal && !proposal.cover_enabled) {
      setShowCover(false);
    }
  }, [proposal]);

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

  // Tab title
  useEffect(() => {
    if (proposal) document.title = proposal.title;
    return () => { document.title = 'Proposal Viewer'; };
  }, [proposal]);

  const bgPrimary   = branding.bg_primary    || '#0f0f0f';
  const bgSecondary = branding.bg_secondary  || '#141414';
  const accent      = branding.accent_color  || '#ff6700';
  const border      = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';
  const pageOrientation = proposal?.page_orientation === 'landscape' ? 'landscape' as const : 'portrait' as const;

  const unresolvedCommentCount = comments.filter((c) => !c.parent_id && !c.resolved_at).length;

  // ── Early returns AFTER all hooks ──────────────────────────────────

  if (!brandingLoaded) {
    return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (loading) {
    return <ViewerLoader branding={branding} loading={true} label="Loading proposal…" />;
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
          <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  // Cover page
  if (showCover && proposal?.cover_enabled) {
    return (
      <>
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CoverPage proposal={proposal as any} branding={branding} onStart={() => setShowCover(false)} />
      </>
    );
  }

  return (
    <div
      className="flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: bgPrimary, height: '100dvh' }}
    >
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar, branding.title_font_family]} />

      {/* Accept modal */}
      {showAcceptModal && proposal && (
        <AcceptModal
          title={proposal.title}
          onAccept={async (name) => { await acceptProposal(name); }}
          onClose={() => setShowAcceptModal(false)}
          accentColor={accent}
          bgColor={bgSecondary}
          textColor={sidebarText}
          acceptTextColor={branding.accept_text_color || '#ffffff'}
          buttonText={proposal.accept_button_text ?? undefined}
          postAcceptAction={(proposal.post_accept_action as 'redirect' | 'message' | null) ?? null}
          postAcceptRedirectUrl={proposal.post_accept_redirect_url ?? null}
          postAcceptMessage={proposal.post_accept_message ?? null}
        />
      )}

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

        <div className="w-10" />
      </div>

      {/* Sidebar */}
      <Sidebar
        numPages={numPages}
        currentPage={currentPage}
        pageEntries={pageEntries}
        getPageName={getPageName}
        onPageSelect={goToPage}
        branding={branding}
        mobileOpen={mobileSidebar}
        onMobileClose={() => setMobileSidebar(false)}
        accepted={accepted}
        onAcceptClick={() => setShowAcceptModal(true)}
        showComments={showComments}
        onToggleComments={() => setShowComments((v) => !v)}
        commentCount={unresolvedCommentCount}
        acceptButtonText={proposal?.accept_button_text ?? undefined}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-w-0 relative overflow-hidden">
        {/* Page content */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {currentPageLink && (
            <PageLinkButton
              url={currentPageLink.url}
              label={currentPageLink.label}
              accentColor={accent}
            />
          )}

          {onTocPage && tocSettings ? (
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
                  orientation={pageOrientation}
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
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <TextPage
                  textPage={currentTextPage as any}
                  branding={branding}
                  companyName={branding.name}
                  proposalTitle={proposal?.title}
                  clientLogoUrl={clientLogoUrl ?? undefined}
                  orientation={pageOrientation}
                />
              </div>
            </div>
          ) : onPricingPage && pricing ? (
            <div
              ref={mainRef}
              className="flex-1 overflow-auto relative"
              style={{ backgroundColor: bgPrimary }}
            >
              <ViewerBackground branding={branding} />
              <div className="relative h-full">
                <PricingPage
                  pricing={pricing as unknown as ProposalPricing}
                  branding={branding}
                  clientName={proposal?.client_name ?? undefined}
                  orientation={pageOrientation}
                />
              </div>
            </div>
          ) : onPackagesPage && currentPackages ? (
            <div
              ref={mainRef}
              className="flex-1 overflow-auto relative"
              style={{ backgroundColor: bgPrimary }}
            >
              <ViewerBackground branding={branding} />
              <div className="relative h-full">
                <PackagesPage
                  packages={currentPackages as unknown as ProposalPackages}
                  branding={branding}
                  clientName={proposal?.client_name ?? undefined}
                  orientation={pageOrientation}
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
              pageUrls={pageUrls.filter((p) => p.type === 'pdf')}
            />
          )}

          <PageNumberBadge
            currentPage={currentPage}
            totalPages={numPages}
            accentColor={accent}
            circleColor={branding.page_num_circle_color ?? undefined}
            textColor={branding.page_num_text_color ?? undefined}
          />

          <FloatingToolbar
            pdfUrl={pdfUrl}
            title={proposal?.title || ''}
            currentPage={currentPage}
            numPages={numPages}
            onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
            onNextPage={() => goToPage(Math.min(numPages, currentPage + 1))}
            bgColor={bgSecondary}
            borderColor={border}
            accentColor={accent}
          />
        </div>

        {/* Comments panel (desktop: inline; mobile: overlay inside CommentsPanel) */}
        {showComments && (
          <CommentsPanel
            comments={comments}
            currentPage={currentPage}
            getPageName={getPageName}
            onGoToPage={goToPage}
            onSubmit={submitComment}
            onReply={replyToComment}
            onResolve={resolveComment}
            onUnresolve={unresolveComment}
            onClose={() => setShowComments(false)}
            accentColor={accent}
            acceptTextColor={branding.accept_text_color || '#ffffff'}
            textColor={sidebarText}
            bgPrimary={bgPrimary}
            bgSecondary={bgSecondary}
          />
        )}
      </div>
    </div>
  );
}