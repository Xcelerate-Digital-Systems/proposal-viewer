// app/doc/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Menu, ChevronLeft, ChevronRight, Building2, X } from 'lucide-react';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import { useDocument, deriveBorderColor } from '@/hooks/useDocument';
import { PageNameEntry } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import CoverPage from '@/components/viewer/CoverPage';
import PdfViewer from '@/components/viewer/PdfViewer';
import TextPage from '@/components/viewer/TextPage';
import FloatingToolbar from '@/components/viewer/FloatingToolbar';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import { exportCompositePdf } from '@/lib/compositeExport';

/* ─── Inline Document Sidebar (no accept / comments) ─────────────── */

interface NavItem {
  pageNum: number;
  name: string;
  isGroup: boolean; // true = section header only, no navigable page
  children: { pageNum: number; name: string }[];
}

function buildNavTree(entries: PageNameEntry[], numPages: number): NavItem[] {
  const tree: NavItem[] = [];
  let virtualPage = 0; // increments only for non-group entries

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isGroup = entry.type === 'group';

    if (!isGroup) {
      virtualPage++;
      if (virtualPage > numPages) break; // don't exceed total virtual pages
    }

    if (entry.indent > 0 && tree.length > 0) {
      // Nested child — attach to the last parent/group
      if (!isGroup) {
        tree[tree.length - 1].children.push({ pageNum: virtualPage, name: entry.name });
      }
    } else {
      // Top-level item: groups get a stable negative ID (for expandedGroup key)
      const pageNum = isGroup ? -(i + 1) : virtualPage;
      tree.push({ pageNum, name: entry.name, isGroup, children: [] });
    }
  }
  return tree;
}

function DocumentSidebar({
  numPages,
  currentPage,
  pageEntries,
  onPageSelect,
  branding,
  mobileOpen,
  onMobileClose,
}: {
  numPages: number;
  currentPage: number;
  pageEntries: PageNameEntry[];
  onPageSelect: (page: number) => void;
  branding: CompanyBranding;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const navTree = buildNavTree(pageEntries, numPages);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const accent = branding.accent_color || '#ff6700';
  const bgSecondary = branding.bg_secondary || '#141414';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';

  useEffect(() => {
    for (const item of navTree) {
      if (item.children.length > 0) {
        if (item.isGroup) {
          // Group headers: expand only when a child is active
          if (item.children.some((c) => c.pageNum === currentPage)) {
            setExpandedGroup(item.pageNum);
            return;
          }
        } else {
          // Regular parents: expand when parent or child is active
          if (item.pageNum === currentPage || item.children.some((c) => c.pageNum === currentPage)) {
            setExpandedGroup(item.pageNum);
            return;
          }
        }
      }
    }
    setExpandedGroup(null);
  }, [currentPage, numPages, pageEntries.length]);

  const handleParentClick = (item: NavItem) => {
    if (item.isGroup) {
      // Group headers: toggle expand/collapse, navigate to first child if expanding
      const willExpand = expandedGroup !== item.pageNum;
      setExpandedGroup(willExpand ? item.pageNum : null);
      if (willExpand && item.children.length > 0) {
        onPageSelect(item.children[0].pageNum);
      }
      onMobileClose();
    } else {
      onPageSelect(item.pageNum);
      onMobileClose();
    }
  };

  const handleChildClick = (pageNum: number) => {
    onPageSelect(pageNum);
    onMobileClose();
  };

  const isChildActive = (item: NavItem) =>
    item.children.some((c) => c.pageNum === currentPage);

  const content = (
    <>
      {/* Logo / company name */}
      <div className="px-5 py-4 shrink-0 border-b flex items-center justify-between" style={{ borderColor: border }}>
        <div className="min-w-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-6 max-w-[180px] object-contain" />
          ) : branding.name ? (
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#555]" />
              <span className="text-sm font-medium truncate" style={{ color: sidebarText }}>{branding.name}</span>
            </div>
          ) : (
            <img src="/logo-white.svg" alt="Logo" className="h-6" />
          )}
        </div>
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1 text-[#666] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <div
        className="flex-1 overflow-y-auto tab-sidebar pt-2"
        style={{
          fontFamily: fontFamily(branding.font_sidebar),
          fontWeight: branding.font_sidebar_weight ? Number(branding.font_sidebar_weight) : undefined,
        }}
      >
        {navTree.map((item) => {
          const hasChildren = item.children.length > 0;
          const isExpanded = expandedGroup === item.pageNum;
          // Groups never have an "active" state themselves — only their children do
          const isParentActive = !item.isGroup && currentPage === item.pageNum;
          const childActive = isChildActive(item);
          const groupActive = isParentActive || childActive;

          return (
            <div key={`${item.pageNum}-${item.isGroup ? 'g' : 'p'}`}>
              <button
                onClick={() => handleParentClick(item)}
                className="w-full text-left flex items-center justify-between transition-colors truncate relative"
                style={{ padding: item.isGroup ? '12px 20px 8px' : '10px 20px' }}
              >
                <span
                  className={`truncate text-sm ${
                    item.isGroup
                      ? 'uppercase tracking-wider text-xs font-semibold'
                      : isParentActive
                      ? 'font-semibold'
                      : childActive && !isExpanded
                      ? 'font-medium'
                      : ''
                  }`}
                  style={{
                    color: item.isGroup
                      ? (childActive ? `${sidebarText}cc` : `${sidebarText}66`)
                      : isParentActive
                      ? sidebarText
                      : childActive && !isExpanded
                      ? `${sidebarText}cc`
                      : hasChildren
                      ? `${sidebarText}aa`
                      : `${sidebarText}88`,
                  }}
                >
                  {item.name}
                </span>

                {/* Chevron for groups, dot for regular parents */}
                {item.isGroup ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    className="shrink-0 ml-2 transition-transform"
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      color: childActive ? `${sidebarText}aa` : `${sidebarText}44`,
                    }}
                  >
                    <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                ) : hasChildren ? (
                  <span
                    className="shrink-0 ml-2 w-1 h-1 rounded-full transition-opacity"
                    style={{
                      backgroundColor: groupActive ? accent : '#555',
                      opacity: isExpanded ? 1 : 0.7,
                    }}
                  />
                ) : null}

                {/* Accent underline for parent items with children (not groups) */}
                {hasChildren && !item.isGroup && (
                  <span
                    className="absolute bottom-0 left-5 right-5 h-px transition-opacity"
                    style={{
                      backgroundColor: groupActive ? accent : '#333',
                      opacity: isExpanded ? 0.4 : 0.15,
                    }}
                  />
                )}
              </button>

              {hasChildren && isExpanded && (
                <div className="ml-5 mr-3 mb-1" style={{ borderLeft: `2px solid ${accent}40` }}>
                  {item.children.map((child) => (
                    <button
                      key={child.pageNum}
                      onClick={() => handleChildClick(child.pageNum)}
                      className={`w-full text-left pl-4 pr-3 py-2 text-sm transition-colors truncate ${
                        currentPage === child.pageNum ? 'font-semibold' : ''
                      }`}
                      style={{
                        color: currentPage === child.pageNum ? sidebarText : `${sidebarText}66`,
                      }}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex w-64 flex-col shrink-0 border-r"
        style={{ backgroundColor: bgSecondary, borderColor: border }}
      >
        {content}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            style={{ backgroundColor: bgSecondary }}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Document Viewer Page ────────────────────────────────────────── */

export default function DocumentViewerPage({ params }: { params: { token: string } }) {
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
    isTextPage,
    getTextPageId,
    getTextPage,
    toPdfPage,
    onDocumentLoadSuccess,
    getPageName,
  } = useDocument(params.token);

  const [showCover, setShowCover] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Is the current virtual page a text page?
  const onTextPage = isTextPage(currentPage);
  const currentTextPageId = getTextPageId(currentPage);
  const currentTextPage = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  // If not a text page, what PDF page should we show?
  const pdfPage = toPdfPage(currentPage);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  // Dismiss cover state when cover isn't enabled so keyboard nav works
  useEffect(() => {
    if (doc && !doc.cover_enabled) {
      setShowCover(false);
    }
  }, [doc]);

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
    if (doc) {
      document.title = doc.title;
    }
    return () => { document.title = 'Document Viewer'; };
  }, [doc]);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';

  // ── Composite PDF download (includes text pages) ───────────────────
  const hasSpecialPages = textPages.length > 0;
  const noPricing = useCallback(() => false, []);

  const handleCompositeDownload = useCallback(async () => {
    if (!pdfUrl) throw new Error('No PDF URL available');
    return exportCompositePdf({
      pdfUrl,
      title: doc?.title || 'document',
      numPages,
      isPricingPage: noPricing,
      isTextPage,
      getTextPageId,
      toPdfPage,
      getTextPage,
      pricing: null,
      branding,
      companyName: branding.name,
      proposalTitle: doc?.title,
    });
  }, [pdfUrl, doc, numPages, noPricing, isTextPage, getTextPageId, toPdfPage, getTextPage, branding]);

  // ── Early returns AFTER all hooks ──────────────────────────────────

  if (!brandingLoaded) {
    return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  }

  if (loading) {
    return <ViewerLoader branding={branding} loading={true} label="Loading document…" />;
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
          <h2 className="text-xl font-semibold text-white mb-2">Document Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  // Cover page — build a Proposal-compatible object for the shared CoverPage component
  if (showCover && doc?.cover_enabled) {
    const coverCompat = {
      ...doc,
      client_name: '',
      cover_subtitle: doc.cover_subtitle || doc.description || doc.title,
      cover_button_text: doc.cover_button_text || 'START READING',
      accept_button_text: null,
      status: 'sent' as const,
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

        <div className="w-10" /> {/* spacer for symmetry */}
      </div>

      {/* Sidebar */}
      <DocumentSidebar
        numPages={numPages}
        currentPage={currentPage}
        pageEntries={pageEntries}
        onPageSelect={goToPage}
        branding={branding}
        mobileOpen={mobileSidebar}
        onMobileClose={() => setMobileSidebar(false)}
      />

      {/* Main content — PDF viewer */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Conditionally render Text page or PDF */}
        {onTextPage && currentTextPage ? (
          <div
            ref={mainRef}
            className="flex-1 overflow-auto"
            style={{ backgroundColor: bgPrimary }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TextPage
              textPage={currentTextPage as any}
              branding={branding}
              companyName={branding.name}
              proposalTitle={doc?.title}
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
          title={doc?.title || ''}
          currentPage={currentPage}
          numPages={numPages}
          onPrevPage={() => goToPage(Math.max(1, currentPage - 1))}
          onNextPage={() => goToPage(Math.min(numPages, currentPage + 1))}
          bgColor={bgSecondary}
          borderColor={border}
          accentColor={accent}
          onCompositeDownload={hasSpecialPages && pdfUrl ? handleCompositeDownload : undefined}
        />
      </div>
    </div>
  );
}