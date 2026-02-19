// app/view/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useProposal, deriveBorderColor } from '@/hooks/useProposal';
import CoverPage from '@/components/viewer/CoverPage';
import Sidebar from '@/components/viewer/Sidebar';
import PdfViewer from '@/components/viewer/PdfViewer';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import CommentsPanel from '@/components/viewer/CommentsPanel';
import AcceptModal from '@/components/viewer/AcceptModal';

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
  const mainRef = useRef<HTMLDivElement>(null);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  const handleAccept = async (name: string) => {
    await acceptProposal(name);
    setShowAccept(false);
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: branding.accent_color }} />
          <p className="text-[#666] text-sm">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: branding.bg_secondary || '#1a1a1a' }}>
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  if (showCover && proposal?.cover_enabled) {
    return <CoverPage proposal={proposal} branding={branding} onStart={() => setShowCover(false)} />;
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: bgPrimary }}>
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
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <PdfViewer
          pdfUrl={pdfUrl}
          currentPage={currentPage}
          onLoadSuccess={onDocumentLoadSuccess}
          scrollRef={mainRef}
        />

        <FloatingToolbar
          pdfUrl={pdfUrl}
          title={proposal?.title || ''}
          currentPage={currentPage}
          numPages={numPages}
          onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
          bgColor={branding.bg_secondary}
          borderColor={deriveBorderColor(branding.bg_secondary || '#141414')}
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
          accentColor={branding.accent_color}
          bgPrimary={branding.bg_primary}
          bgSecondary={branding.bg_secondary}
        />
      )}

      {showAccept && (
        <AcceptModal
          title={proposal?.title || ''}
          onAccept={handleAccept}
          onClose={() => setShowAccept(false)}
          accentColor={branding.accent_color}
          bgSecondary={branding.bg_secondary}
        />
      )}
    </div>
  );
}