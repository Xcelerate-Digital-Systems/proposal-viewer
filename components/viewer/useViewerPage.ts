// components/viewer/useViewerPage.ts
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useProposal, deriveBorderColor } from '@/hooks/useProposal';
import { ProposalPricing, ProposalPackages } from '@/lib/supabase';
import { exportCompositePdf } from '@/lib/compositeExport';

export function useViewerPage(token: string) {
  const hook = useProposal(token);
  const {
    proposal, pdfUrl, numPages, currentPage, setCurrentPage,
    loading, notFound, pageEntries, branding, brandingLoaded,
    comments, accepted, declined, revisionRequested,
    pricing, packages, textPages,
    isPricingPage, isPackagesPage, isTocPage, isTextPage,
    getPackagesId, getTextPageId, getTextPage, toPdfPage,
    tocSettings, pageSequence, onDocumentLoadSuccess, pageUrls, getPageName,
    acceptProposal, declineProposal, requestRevision,
    submitComment, replyToComment, resolveComment, unresolveComment,
  } = hook;

  /* ── Local UI state ────────────────────────────────────────────────────── */

  const [showCover, setShowCover]           = useState(true);
  const [clientLogoUrl, setClientLogoUrl]   = useState<string | undefined>(undefined);
  const [showAcceptModal, setShowAcceptModal]     = useState(false);
  const [showDeclineModal, setShowDeclineModal]   = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showComments, setShowComments]     = useState(false);
  const [mobileSidebar, setMobileSidebar]   = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  /* ── Derived page state ────────────────────────────────────────────────── */

  const onTocPage      = isTocPage(currentPage);
  const onTextPage     = isTextPage(currentPage);
  const onPricingPage  = isPricingPage(currentPage);
  const onPackagesPage = isPackagesPage(currentPage);
  const currentTextPageId = getTextPageId(currentPage);
  const currentTextPage   = currentTextPageId ? getTextPage(currentTextPageId) : undefined;
  const currentPackagesId = getPackagesId(currentPage);
  const currentPackages   = currentPackagesId
    ? packages.find((p: Record<string, unknown>) => p.id === currentPackagesId)
    : null;
  const pdfPage = toPdfPage(currentPage);

  const isSectionPage = pageUrls[currentPage - 1]?.type === 'section';
  const currentPageLink = useMemo(() => {
    const entry = pageUrls[currentPage - 1];
    return entry?.link_url ? { url: entry.link_url, label: entry.link_label ?? undefined } : null;
  }, [pageUrls, currentPage]);

  /* ── Derived branding ──────────────────────────────────────────────────── */

  const bgPrimary   = branding.bg_primary   || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent      = branding.accent_color || '#01434A';
  const border      = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';
  const pageOrientation = proposal?.page_orientation === 'landscape' ? 'landscape' as const : 'portrait' as const;
  const unresolvedCommentCount = comments.filter((c) => !c.parent_id && !c.resolved_at).length;

  /* ── Effects ───────────────────────────────────────────────────────────── */

  // Fetch client logo
  useEffect(() => {
    if (!proposal?.cover_client_logo_path) { setClientLogoUrl(undefined); return; }
    fetch(`/api/member-badge?path=${encodeURIComponent(proposal.cover_client_logo_path)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.avatar_url) setClientLogoUrl(data.avatar_url); });
  }, [proposal?.cover_client_logo_path]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCurrentPage]);

  // Auto-skip section pages
  useEffect(() => {
    if (isSectionPage && pageUrls.length > 0) {
      const next = currentPage < pageUrls.length ? currentPage + 1 : currentPage - 1;
      goToPage(next);
    }
  }, [isSectionPage, currentPage, pageUrls.length, goToPage]);

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
        if (currentPage < pageUrls.length) goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentPage > 1) goToPage(currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(pageUrls.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, goToPage, showCover, pageUrls.length]);

  // Tab title
  useEffect(() => {
    if (proposal) document.title = proposal.title;
    return () => { document.title = 'Proposal Viewer'; };
  }, [proposal]);

  /* ── Composite download ────────────────────────────────────────────────── */

  const handleCompositeDownload = useCallback(async () => {
    if (!pdfUrl && pageUrls.length === 0) throw new Error('No PDF data available');
    const entityOrientation = proposal?.page_orientation || 'auto';
    return exportCompositePdf({
      pdfUrl,
      pageUrls,
      title: proposal?.title || 'proposal',
      numPages,
      isPricingPage,
      isPackagesPage,
      isTextPage,
      getTextPageId,
      toPdfPage,
      getTextPage,
      pricing: pricing as ProposalPricing | null,
      packages: packages as ProposalPackages[],
      getPackagesId,
      branding,
      clientName: proposal?.client_name ?? undefined,
      clientLogoUrl: clientLogoUrl ?? null,
      companyName: branding.name,
      userName: proposal?.created_by_name ?? undefined,
      proposalTitle: proposal?.title,
      pricingOrientation: entityOrientation,
      textPageOrientations: Object.fromEntries(
        textPages.map(tp => [tp.id, entityOrientation])
      ),
      pageEntries,
      isTocPage,
      tocSettings,
      pageSequence,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proposal: proposal as any,
      includeCover: true,
    });
  }, [pdfUrl, pageUrls, proposal, numPages, isPricingPage, isPackagesPage, isTextPage,
      getTextPageId, toPdfPage, getTextPage, pricing, packages, getPackagesId,
      branding, clientLogoUrl, textPages, pageEntries, isTocPage, tocSettings, pageSequence]);

  return {
    // From useProposal
    proposal, pdfUrl, numPages, currentPage,
    loading, notFound, pageEntries, branding, brandingLoaded,
    comments, accepted, declined, revisionRequested,
    pricing, onDocumentLoadSuccess, pageUrls, getPageName,
    acceptProposal, declineProposal, requestRevision,
    submitComment, replyToComment, resolveComment, unresolveComment,
    tocSettings, pageSequence,

    // Local state
    showCover, setShowCover,
    clientLogoUrl,
    showAcceptModal, setShowAcceptModal,
    showDeclineModal, setShowDeclineModal,
    showRevisionModal, setShowRevisionModal,
    showComments, setShowComments,
    mobileSidebar, setMobileSidebar,
    mainRef,

    // Derived
    onTocPage, onTextPage, onPricingPage, onPackagesPage,
    currentTextPage, currentPackages, pdfPage,
    currentPageLink,
    bgPrimary, bgSecondary, accent, border, sidebarText,
    pageOrientation, unresolvedCommentCount,

    // Actions
    goToPage,
    handleCompositeDownload,
  };
}
