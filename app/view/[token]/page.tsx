// app/view/[token]/page.tsx
'use client';

import { FileText, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import Sidebar from '@/components/viewer/Sidebar';
import CoverPage from '@/components/viewer/CoverPage';
import CommentsPanel from '@/components/viewer/CommentsPanel';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';
import ViewerModals from '@/components/viewer/ViewerModals';
import ViewerPageContent from '@/components/viewer/ViewerPageContent';
import { useViewerPage } from '@/components/viewer/useViewerPage';

export default function ProposalViewerPage({ params }: { params: { token: string } }) {
  const v = useViewerPage(params.token);

  // ── Early returns (after all hooks) ──────────────────────────────────

  if (!v.brandingLoaded) {
    return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (v.loading) {
    return <ViewerLoader branding={v.branding} loading={true} label="Loading proposal…" />;
  }

  if (v.notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: v.bgPrimary }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: v.bgSecondary }}>
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  if (v.showCover && v.proposal?.cover_enabled) {
    return (
      <>
        <GoogleFontLoader fonts={[v.branding.font_heading, v.branding.font_body, v.branding.font_sidebar, v.branding.title_font_family]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CoverPage proposal={v.proposal as any} branding={v.branding} onStart={() => v.setShowCover(false)} />
      </>
    );
  }

  // ── Main viewer ────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: v.bgPrimary, height: '100dvh' }}
    >
      <GoogleFontLoader fonts={[v.branding.font_heading, v.branding.font_body, v.branding.font_sidebar, v.branding.title_font_family]} />

      {/* Modals */}
      {v.proposal && (
        <ViewerModals
          proposal={v.proposal as Record<string, unknown>}
          accent={v.accent}
          bgSecondary={v.bgSecondary}
          sidebarText={v.sidebarText}
          acceptTextColor={v.branding.accept_text_color || '#ffffff'}
          showAcceptModal={v.showAcceptModal}
          onCloseAccept={() => v.setShowAcceptModal(false)}
          onAccept={async (name) => { await v.acceptProposal(name); }}
          showDeclineModal={v.showDeclineModal}
          onCloseDecline={() => v.setShowDeclineModal(false)}
          onDecline={async (name, reason) => { await v.declineProposal(name, reason); v.setShowDeclineModal(false); }}
          showRevisionModal={v.showRevisionModal}
          onCloseRevision={() => v.setShowRevisionModal(false)}
          onRevision={async (name, notes) => { await v.requestRevision(name, notes); v.setShowRevisionModal(false); }}
        />
      )}

      {/* Mobile header */}
      <div
        className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b shrink-0 z-20"
        style={{ backgroundColor: v.bgSecondary, borderColor: v.border }}
      >
        <button onClick={() => v.setMobileSidebar(true)} className="p-2 transition-opacity hover:opacity-70 rounded-lg" style={{ color: v.sidebarText }}>
          <Menu size={20} />
        </button>
        <div className="flex-1 min-w-0 mx-1 flex items-center justify-center gap-1">
          <button onClick={() => v.currentPage > 1 && v.goToPage(v.currentPage - 1)} disabled={v.currentPage <= 1} className="p-1.5 rounded-lg transition-opacity disabled:opacity-20" style={{ color: v.sidebarText }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs truncate px-1" style={{ color: v.sidebarText, opacity: 0.55 }}>
            {v.getPageName(v.currentPage)}
            {v.numPages > 0 && ` · ${v.currentPage}/${v.numPages}`}
          </span>
          <button onClick={() => v.currentPage < v.pageUrls.length && v.goToPage(v.currentPage + 1)} disabled={v.currentPage >= v.pageUrls.length} className="p-1.5 rounded-lg transition-opacity disabled:opacity-20" style={{ color: v.sidebarText }}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="w-10" />
      </div>

      {/* Sidebar */}
      <Sidebar
        numPages={v.numPages}
        currentPage={v.currentPage}
        pageEntries={v.pageEntries}
        getPageName={v.getPageName}
        onPageSelect={v.goToPage}
        branding={v.branding}
        mobileOpen={v.mobileSidebar}
        onMobileClose={() => v.setMobileSidebar(false)}
        accepted={v.accepted}
        declined={v.declined}
        revisionRequested={v.revisionRequested}
        onAcceptClick={() => v.setShowAcceptModal(true)}
        onDeclineClick={() => v.setShowDeclineModal(true)}
        onRevisionClick={() => v.setShowRevisionModal(true)}
        showComments={v.showComments}
        onToggleComments={() => v.setShowComments((prev) => !prev)}
        commentCount={v.unresolvedCommentCount}
        acceptButtonText={v.proposal?.accept_button_text ?? undefined}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-w-0 relative overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 relative">
          {v.currentPageLink && (
            <PageLinkButton url={v.currentPageLink.url} label={v.currentPageLink.label} accentColor={v.accent} />
          )}

          <ViewerPageContent
            branding={v.branding}
            bgPrimary={v.bgPrimary}
            pageOrientation={v.pageOrientation}
            scrollRef={v.mainRef}
            onTocPage={v.onTocPage}
            onTextPage={v.onTextPage}
            onPricingPage={v.onPricingPage}
            onPackagesPage={v.onPackagesPage}
            tocSettings={v.tocSettings}
            pageSequence={v.pageSequence}
            pageEntries={v.pageEntries}
            numPages={v.numPages}
            currentTextPage={v.currentTextPage as Record<string, unknown> | undefined}
            pricing={v.pricing}
            currentPackages={v.currentPackages}
            pdfUrl={v.pdfUrl}
            pdfPage={v.pdfPage}
            onLoadSuccess={v.onDocumentLoadSuccess}
            accentColor={v.accent}
            pageUrls={v.pageUrls}
            proposal={v.proposal as Record<string, unknown> | null}
            clientLogoUrl={v.clientLogoUrl}
          />

          <PageNumberBadge
            currentPage={v.currentPage}
            totalPages={v.numPages}
            accentColor={v.accent}
            circleColor={v.branding.page_num_circle_color ?? undefined}
            textColor={v.branding.page_num_text_color ?? undefined}
          />

          <FloatingToolbar
            pdfUrl={v.pdfUrl}
            title={v.proposal?.title || ''}
            currentPage={v.currentPage}
            numPages={v.numPages}
            onPrevPage={() => v.goToPage(Math.max(1, v.currentPage - 1))}
            onNextPage={() => v.goToPage(Math.min(v.pageUrls.length, v.currentPage + 1))}
            bgColor={v.bgSecondary}
            borderColor={v.border}
            accentColor={v.accent}
            onCompositeDownload={v.pageUrls.length > 0 ? v.handleCompositeDownload : undefined}
          />
        </div>

        {v.showComments && (
          <CommentsPanel
            comments={v.comments}
            currentPage={v.currentPage}
            getPageName={v.getPageName}
            onGoToPage={v.goToPage}
            onSubmit={v.submitComment}
            onReply={v.replyToComment}
            onResolve={v.resolveComment}
            onUnresolve={v.unresolveComment}
            onClose={() => v.setShowComments(false)}
            accentColor={v.accent}
            acceptTextColor={v.branding.accept_text_color || '#ffffff'}
            textColor={v.sidebarText}
            bgPrimary={v.bgPrimary}
            bgSecondary={v.bgSecondary}
          />
        )}
      </div>
    </div>
  );
}
