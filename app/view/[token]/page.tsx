// app/view/[token]/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Menu, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import Sidebar from '@/components/viewer/Sidebar';
import CoverPage from '@/components/viewer/CoverPage';
import CommentsPanel from '@/components/viewer/CommentsPanel';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import PageLinkButton from '@/components/viewer/PageLinkButton';
import PageNumberBadge from '@/components/viewer/PageNumberBadge';
import ViewerPageContent from '@/components/viewer/ViewerPageContent';
import QuoteSinglePageView from '@/components/viewer/QuoteSinglePageView';
import { useViewerPage } from '@/components/viewer/useViewerPage';
import { supabase, type ProposalPricing } from '@/lib/supabase';
import { useViewerTracking } from '@/hooks/useViewerTracking';

export default function ProposalViewerPage(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const v = useViewerPage(params.token);
  const searchParams = useSearchParams();
  const autoPrint = searchParams?.get('print') === '1';

  const { trackPageView } = useViewerTracking({
    shareToken: params.token,
    viewerName: v.proposal?.client_name ?? null,
    viewerEmail: v.proposal?.client_email ?? null,
    enabled: !!v.proposal && !autoPrint,
  });

  useEffect(() => {
    if (v.proposal) trackPageView(v.currentPage);
  }, [v.currentPage, v.proposal, trackPageView]);

  // Fetch company contact / ABN / quote-number format for the quote header
  // and footer. These fields aren't in CompanyBranding.
  const [companyContact, setCompanyContact] = useState<{
    name: string;
    phone: string | null;
    email: string | null;
    abn: string | null;
    quoteNumberPrefix: string | null;
    quoteNumberPadWidth: number | null;
  } | null>(null);
  const companyIdForFetch = v.proposal?.entity_type === 'quote' ? v.proposal.company_id : null;
  useEffect(() => {
    if (!companyIdForFetch) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('name, phone, contact_email, abn, quote_number_prefix, quote_number_pad_width')
      .eq('id', companyIdForFetch)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setCompanyContact({
          name: (data.name as string) ?? '',
          phone: (data.phone as string) ?? null,
          email: (data.contact_email as string) ?? null,
          abn: (data.abn as string) ?? null,
          quoteNumberPrefix: (data.quote_number_prefix as string) ?? null,
          quoteNumberPadWidth: (data.quote_number_pad_width as number) ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [companyIdForFetch]);

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

  // ── Quote viewer (single-page scroll, QuoteWin-style) ───────────────
  // First-load lands on the full-screen Cover overlay (same as proposals),
  // then click "Start" to reveal the quote body. The cover repeats at the
  // top of the scroll once dismissed so the customer can scroll back up.
  if (v.proposal?.entity_type === 'quote') {
    const showingCover = v.showCover && v.proposal?.cover_enabled;
    if (showingCover) {
      return (
        <div className="fixed inset-0 z-50">
          <GoogleFontLoader
            fonts={[
              v.branding.font_heading,
              v.branding.font_body,
              v.branding.title_font_family,
              v.proposal.title_font_family,
              v.branding.font_button,
            ]}
          />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <CoverPage proposal={v.proposal as any} branding={v.branding} onStart={() => v.setShowCover(false)} />
        </div>
      );
    }
    // Page-around bg is intentionally separate from the document bg —
    // think of the quote as a printed card floating on a desk. The
    // surrounding bg is fixed light gray so the card always has contrast;
    // text_page_bg_color (Design tab) controls the *quote document* itself.
    const pageBg = v.proposal.quote_page_bg_color || '#eeece6';
    return (
      <div
        className="h-screen overflow-y-auto print:h-auto print:overflow-visible quote-print-root"
        style={{ backgroundColor: pageBg }}
      >
        <GoogleFontLoader
          fonts={[
            v.branding.font_heading,
            v.branding.font_body,
            v.branding.title_font_family,
            v.proposal.title_font_family,
            v.branding.font_button,
          ]}
        />
        {/* Auto-print trigger for admin ?print=1 deep links. The visible
            "Download PDF" affordance now floats in the corner (see below). */}
        <PrintTrigger autoPrint={autoPrint} />
        <div className="max-w-3xl mx-auto pt-6 pb-10 px-4 print:max-w-none print:px-0 print:pb-0 print:pt-0">
          <div className="rounded-2xl overflow-hidden shadow-popover print:rounded-none print:shadow-none">
            <QuoteSinglePageView
              proposal={v.proposal}
              pricing={(v.pricing as unknown as ProposalPricing | null) ?? null}
              branding={v.branding}
              accepted={v.accepted}
              declined={v.declined}
              revisionRequested={v.revisionRequested}
              companyName={companyContact?.name || v.branding.name}
              companyPhone={companyContact?.phone ?? null}
              companyEmail={companyContact?.email ?? null}
              companyAbn={companyContact?.abn ?? null}
              quoteNumberFormat={{
                prefix: companyContact?.quoteNumberPrefix ?? null,
                padWidth: companyContact?.quoteNumberPadWidth ?? null,
              }}
              requireSignature={(v.proposal as Record<string, unknown>)?.require_signature as boolean ?? false}
              onAccept={async (name, sig) => {
                await v.acceptProposal(name, sig);
              }}
              onDecline={async (name, reason) => {
                await v.declineProposal(name, reason);
              }}
              onRequestRevision={async (name, notes) => {
                await v.requestRevision(name, notes);
              }}
            />
          </div>
        </div>

        {/* Floating Download PDF — fixed to the bottom-right of the viewport
            so it's always reachable while scrolling without competing with
            the quote content. Hidden in the printed output. */}
        <button
          type="button"
          onClick={() => window.print()}
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur border border-edge-strong shadow-md text-xs font-medium text-prose hover:text-ink hover:shadow-lg transition-all print:hidden"
        >
          <Download size={13} />
          Download PDF
        </button>
      </div>
    );
  }

  const showingCover = v.showCover && v.proposal?.cover_enabled;

  // ── Main viewer ────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: v.bgPrimary, height: '100dvh' }}
    >
      <GoogleFontLoader fonts={[v.branding.font_heading, v.branding.font_body, v.branding.font_sidebar, v.branding.title_font_family, v.branding.font_button]} />

      {/* Cover overlay — fades out on Start, revealing the viewer underneath */}
      {showingCover && (
        <div className="fixed inset-0 z-50">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <CoverPage proposal={v.proposal as any} branding={v.branding} onStart={() => v.setShowCover(false)} />
        </div>
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
            onDecisionPage={v.onDecisionPage}
            tocSettings={v.tocSettings}
            pageSequence={v.pageSequence}
            pageEntries={v.pageEntries}
            numPages={v.numPages}
            currentTextPage={v.currentTextPage as Record<string, unknown> | undefined}
            pricing={v.currentPricing ?? v.pricing}
            currentPackages={v.currentPackages}
            pdfUrl={v.pdfUrl}
            pdfPage={v.pdfPage}
            onLoadSuccess={v.onDocumentLoadSuccess}
            accentColor={v.accent}
            pageUrls={v.pageUrls}
            proposal={v.proposal as Record<string, unknown> | null}
            clientLogoUrl={v.clientLogoUrl}
            accepted={v.accepted}
            declined={v.declined}
            revisionRequested={v.revisionRequested}
            requireSignature={(v.proposal as Record<string, unknown>)?.require_signature as boolean ?? false}
            onAccept={async (name, sig) => { await v.acceptProposal(name, sig); }}
            onDecline={async (name, reason) => { await v.declineProposal(name, reason); }}
            onRequestRevision={async (name, notes) => { await v.requestRevision(name, notes); }}
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

/* Silent helper — fires window.print() once when the URL carries ?print=1
   (admin clicked "PDF" in the quote header). Renders nothing. The visible
   Download PDF affordance is the floating button next to the quote. */
function PrintTrigger({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, [autoPrint]);
  return null;
}
