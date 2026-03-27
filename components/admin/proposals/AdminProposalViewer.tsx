// components/admin/proposals/AdminProposalViewer.tsx
// Renders the full client-facing viewer (sidebar, branded pages, navigation) inside the
// admin panel, with an "Edit Section" affordance overlaid on editable pages.
// useProposal already skips view-tracking when an authenticated team member is detected.
'use client';

import { useState } from 'react';
import { Menu, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import Sidebar from '@/components/viewer/Sidebar';
import CoverPage from '@/components/viewer/CoverPage';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import ViewerPageContent from '@/components/viewer/ViewerPageContent';
import ViewerModals from '@/components/viewer/ViewerModals';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import { useViewerPage } from '@/components/viewer/useViewerPage';
import SectionEditorPanel, { type ActiveSection } from './SectionEditorPanel';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminProposalViewerProps {
  proposalId: string;
  shareToken: string;
  onExit: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminProposalViewer({ proposalId, shareToken, onExit }: AdminProposalViewerProps) {
  const v = useViewerPage(shareToken);
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);

  /* ── Current page edit state ─────────────────────────────────── */

  const currentEntry = v.pageUrls[v.currentPage - 1];
  const currentType  = currentEntry?.type;
  const isEditable   = currentType === 'pricing' || currentType === 'packages' || currentType === 'text';

  const handleEditClick = () => {
    if (!currentEntry) return;
    if (currentType === 'pricing') {
      setActiveSection({ type: 'pricing' });
    } else if (currentType === 'packages') {
      setActiveSection({ type: 'packages', pageId: currentEntry.id });
    } else if (currentType === 'text') {
      setActiveSection({ type: 'text', pageId: currentEntry.id });
    }
  };

  /* ── Loading / error states ──────────────────────────────────── */

  if (!v.brandingLoaded) {
    return <div className="h-full w-full" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (v.loading) {
    return <ViewerLoader branding={v.branding} loading={true} label="Loading proposal…" />;
  }

  if (v.notFound) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: v.bgPrimary }}>
        <p className="text-white text-sm">Proposal not found.</p>
      </div>
    );
  }

  /* ── Cover page ──────────────────────────────────────────────── */

  if (v.showCover && v.proposal?.cover_enabled) {
    return (
      <>
        <GoogleFontLoader fonts={[v.branding.font_heading, v.branding.font_body, v.branding.font_sidebar, v.branding.title_font_family]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CoverPage proposal={v.proposal as any} branding={v.branding} onStart={() => v.setShowCover(false)} />
      </>
    );
  }

  /* ── Main viewer ─────────────────────────────────────────────── */

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
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-medium text-teal/70 hover:text-teal transition-colors"
        >
          <X size={13} />
          Exit
        </button>
      </div>

      {/* Viewer + optional editor panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: v.bgPrimary }}>
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
          <button
            onClick={() => v.setMobileSidebar(true)}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: v.sidebarText }}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0 mx-1 flex items-center justify-center gap-1">
            <button
              onClick={() => v.currentPage > 1 && v.goToPage(v.currentPage - 1)}
              disabled={v.currentPage <= 1}
              className="p-1.5 rounded-lg transition-opacity disabled:opacity-20"
              style={{ color: v.sidebarText }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs truncate px-1" style={{ color: v.sidebarText, opacity: 0.55 }}>
              {v.getPageName(v.currentPage)}
              {v.numPages > 0 && ` · ${v.currentPage}/${v.numPages}`}
            </span>
            <button
              onClick={() => v.currentPage < v.pageUrls.length && v.goToPage(v.currentPage + 1)}
              disabled={v.currentPage >= v.pageUrls.length}
              className="p-1.5 rounded-lg transition-opacity disabled:opacity-20"
              style={{ color: v.sidebarText }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="w-10" />
        </div>

        {/* Branded sidebar — full client-facing experience */}
        <Sidebar
          numPages={v.numPages}
          currentPage={v.currentPage}
          pageEntries={v.pageEntries}
          getPageName={v.getPageName}
          onPageSelect={(page) => { v.goToPage(page); setActiveSection(null); }}
          branding={v.branding}
          mobileOpen={v.mobileSidebar}
          onMobileClose={() => v.setMobileSidebar(false)}
          accepted={v.accepted}
          declined={v.declined}
          revisionRequested={v.revisionRequested}
          onAcceptClick={() => v.setShowAcceptModal(true)}
          onDeclineClick={() => v.setShowDeclineModal(true)}
          onRevisionClick={() => v.setShowRevisionModal(true)}
          showComments={false}
          onToggleComments={() => {}}
          commentCount={0}
          acceptButtonText={v.proposal?.accept_button_text ?? undefined}
        />

        {/* Content area */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

            {v.currentPageLink && (
              <PageLinkButton url={v.currentPageLink.url} label={v.currentPageLink.label} accentColor={v.accent} />
            )}

            {/* Floating "Edit Section" button for editable pages */}
            {isEditable && (
              <button
                onClick={handleEditClick}
                className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all ${
                  activeSection
                    ? 'bg-teal text-white'
                    : 'bg-white text-teal border border-teal/30 hover:bg-teal hover:text-white'
                }`}
              >
                <Pencil size={13} />
                {activeSection ? 'Editing' : 'Edit Section'}
              </button>
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
              font={v.branding.font_body}
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

            {/* Bottom-sheet section editor — overlays the viewer */}
            {activeSection && (
              <SectionEditorPanel
                proposalId={proposalId}
                section={activeSection}
                onClose={() => setActiveSection(null)}
                onSaved={() => {}}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
