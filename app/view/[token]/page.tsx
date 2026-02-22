// app/view/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Loader2, Menu, CheckCircle2, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProposal, deriveBorderColor } from '@/hooks/useProposal';
import CoverPage from '@/components/viewer/CoverPage';
import Sidebar from '@/components/viewer/Sidebar';
import PdfViewer from '@/components/viewer/PdfViewer';
import PricingPage from '@/components/viewer/PricingPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import CommentsPanel from '@/components/viewer/CommentsPanel';
import AcceptModal from '@/components/viewer/AcceptModal';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

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
    comments,
    accepted,
    branding,
    pricing,
    isPricingPage,
    toPdfPage,
    onDocumentLoadSuccess,
    getPageName,
    acceptProposal,
    submitComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  } = useProposal(params.token);

  const [showComments, setShowComments] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [showCover, setShowCover] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  const handleAccept = async (name: string) => {
    await acceptProposal(name);
    setShowAccept(false);
  };

  // Is the current virtual page the pricing page?
  const onPricingPage = isPricingPage(currentPage);
  // If not pricing, what PDF page should we show?
  const pdfPage = toPdfPage(currentPage);

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
    if (proposal) {
      document.title = `Proposal For ${proposal.client_name}`;
    }
    return () => { document.title = 'Proposal Viewer'; };
  }, [proposal]);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const border = deriveBorderColor(bgSecondary);
  const acceptLabel = proposal?.accept_button_text || undefined;

  if (loading) {
    const loaderTextColor = branding.sidebar_text_color || '#ffffff';
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgSecondary }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: loaderTextColor }} />
          <p className="text-sm" style={{ color: loaderTextColor, opacity: 0.45 }}>Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: bgSecondary }}>
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  if (showCover && proposal?.cover_enabled) {
    return (
      <>
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />
        <CoverPage proposal={proposal} branding={branding} onStart={() => setShowCover(false)} />
      </>
    );
  }

  const sidebarText = branding.sidebar_text_color || '#ffffff';

  return (
    <div
      className="flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: bgPrimary, height: '100dvh' }}
    >
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Mobile header bar — fixed to top, branded */}
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

        {/* Page navigation arrows + label */}
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

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowComments(!showComments)}
            className="relative p-2 transition-colors rounded-lg"
            style={{ color: showComments ? accent : sidebarText, opacity: showComments ? 1 : 0.55 }}
          >
            <MessageSquare size={18} />
            {comments.filter(c => !c.parent_id && !c.resolved_at).length > 0 && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
            )}
          </button>
          {!accepted ? (
            <button
              onClick={() => setShowAccept(true)}
              className="p-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent, color: branding.accept_text_color || '#ffffff' }}
            >
              <CheckCircle2 size={18} />
            </button>
          ) : (
            <div className="p-2 text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar (desktop persistent + mobile drawer) */}
      <Sidebar
        numPages={numPages}
        currentPage={currentPage}
        pageEntries={pageEntries}
        getPageName={getPageName}
        onPageSelect={goToPage}
        accepted={accepted}
        onAcceptClick={() => setShowAccept(true)}
        showComments={showComments}
        onToggleComments={() => setShowComments(!showComments)}
        commentCount={comments.length}
        branding={branding}
        acceptButtonText={acceptLabel}
        mobileOpen={mobileSidebar}
        onMobileClose={() => setMobileSidebar(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Conditionally render PDF or Pricing page */}
        {onPricingPage && pricing ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto"
            style={{ backgroundColor: bgPrimary }}
          >
            <PricingPage
              pricing={pricing}
              branding={branding}
              clientName={proposal?.client_name}
            />
          </div>
        ) : (
          <PdfViewer
            pdfUrl={pdfUrl}
            currentPage={pdfPage}
            onLoadSuccess={onDocumentLoadSuccess}
            scrollRef={mainRef}
            bgColor={bgPrimary}
            accentColor={accent}
          />
        )}

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
          textColor={branding.sidebar_text_color || '#ffffff'}
          bgPrimary={bgPrimary}
          bgSecondary={bgSecondary}
        />
      )}

      {showAccept && (
        <AcceptModal
          title={proposal?.title || ''}
          onAccept={handleAccept}
          onClose={() => setShowAccept(false)}
          accentColor={accent}
          bgColor={bgSecondary}
          textColor={branding.sidebar_text_color || '#ffffff'}
          acceptTextColor={branding.accept_text_color || '#ffffff'}
          buttonText={acceptLabel}
        />
      )}
    </div>
  );
}