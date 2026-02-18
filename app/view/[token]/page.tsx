'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useProposal } from '@/hooks/useProposal';
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
    comments,
    accepted,
    onDocumentLoadSuccess,
    getPageName,
    acceptProposal,
    submitComment,
  } = useProposal(params.token);

  const [showComments, setShowComments] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  const handleAccept = async (name: string) => {
    await acceptProposal(name);
    setShowAccept(false);
  };

  // Keyboard navigation: Arrow keys + Space to navigate slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input/textarea
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
  }, [currentPage, numPages, goToPage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#ff6700] animate-spin" />
          <p className="text-[#666] text-sm">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f] overflow-hidden">
      <header className="h-12 bg-[#141414] border-b border-[#2a2a2a] flex items-center px-5 shrink-0 z-20">
        <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-6" />
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          numPages={numPages}
          currentPage={currentPage}
          getPageName={getPageName}
          onPageSelect={goToPage}
          accepted={accepted}
          onAcceptClick={() => setShowAccept(true)}
          showComments={showComments}
          onToggleComments={() => setShowComments(!showComments)}
          commentCount={comments.length}
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
          />
        </div>

        {showComments && (
          <CommentsPanel
            comments={comments}
            currentPage={currentPage}
            getPageName={getPageName}
            onGoToPage={goToPage}
            onSubmit={submitComment}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>

      {showAccept && (
        <AcceptModal
          title={proposal?.title || ''}
          onAccept={handleAccept}
          onClose={() => setShowAccept(false)}
        />
      )}
    </div>
  );
}