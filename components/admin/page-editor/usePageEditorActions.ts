// components/admin/page-editor/usePageEditorActions.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnifiedPage } from './pageEditorTypes';
import type { usePageEditor } from './usePageEditor';

type PageEditor = ReturnType<typeof usePageEditor>;

export function usePageEditorActions(editor: PageEditor) {
  const {
    pages, pagesLoaded, pdfPages, signedUrls,
    addPage, updatePage, deletePage, insertPdfPage,
  } = editor;

  /* ── Selection ──────────────────────────────────────────────────────────── */

  const [selectedId, setSelectedId]     = useState('');
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    if (pagesLoaded && pages.length > 0 && !selectedId) {
      setSelectedId(pages[0].id);
    }
  }, [pagesLoaded, pages, selectedId]);

  const selectedPage   = pages.find((p) => p.id === selectedId) ?? null;
  const selectedPdfIdx = selectedPage?.type === 'pdf'
    ? pdfPages.findIndex((p) => p.id === selectedId)
    : -1;

  /* ── Panel height ───────────────────────────────────────────────────────── */

  const [panelHeight, setPanelHeight] = useState(520);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        setPanelHeight(Math.max(400, window.innerHeight - rect.top - 32));
      }
    };
    measure();
    const t = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); };
  }, []);

  /* ── Navigation ─────────────────────────────────────────────────────────── */

  const selectedIdx = pages.findIndex((p) => p.id === selectedId);
  const canGoPrev   = selectedIdx > 0;
  const canGoNext   = selectedIdx < pages.length - 1;
  const goPrev      = () => { if (canGoPrev) setSelectedId(pages[selectedIdx - 1].id); };
  const goNext      = () => { if (canGoNext) setSelectedId(pages[selectedIdx + 1].id); };

  /* ── Insert handlers ────────────────────────────────────────────────────── */

  const handleInsertPdf = useCallback(async (afterPage: UnifiedPage | null, file: File) => {
    const afterPos = afterPage ? afterPage.position : -1;
    return insertPdfPage(file, afterPos);
  }, [insertPdfPage]);

  const handleInsertText = useCallback(async (afterPage: UnifiedPage | null) => {
    const newPage = await addPage('text', {
      title:    'New Text Page',
      position: afterPage ? afterPage.position + 1 : undefined,
    });
    if (newPage) setSelectedId(newPage.id);
  }, [addPage]);

  const handleInsertPricing = useCallback(async () => {
    if (pages.some((p) => p.type === 'pricing')) return;
    const newPage = await addPage('pricing', { title: 'Project Investment' });
    if (newPage) setSelectedId(newPage.id);
  }, [pages, addPage]);

  const handleAddPackages = useCallback(async () => {
    const newPage = await addPage('packages', { title: 'Your Investment' });
    if (newPage) setSelectedId(newPage.id);
  }, [addPage]);

  const handleAddSection = useCallback(async () => {
    const newPage = await addPage('section', { title: 'New Section' });
    if (newPage) setSelectedId(newPage.id);
  }, [addPage]);

  const handleAddToc = useCallback(async () => {
    const newPage = await addPage('toc', { title: 'Table of Contents', position: 0 });
    if (newPage) setSelectedId(newPage.id);
  }, [addPage]);

  /* ── Delete ─────────────────────────────────────────────────────────────── */

  const handleDeletePage = useCallback(async (pageId: string) => {
    const currentIdx = pages.findIndex((p) => p.id === pageId);
    const deleted = await deletePage(pageId);
    if (deleted && selectedId === pageId) {
      const next = pages[currentIdx + 1] ?? pages[currentIdx - 1];
      setSelectedId(next?.id ?? '');
    }
  }, [pages, selectedId, deletePage]);

  /* ── Text page update mapping ───────────────────────────────────────────── */

  const handleTextPageUpdate = useCallback((
    pageId: string,
    changes: Record<string, unknown>,
  ) => {
    const { content, ...rest } = changes;
    const mapped: Record<string, unknown> = { ...rest };
    if (content !== undefined) {
      mapped.payload_patch = { content };
    }
    updatePage(pageId, mapped as Parameters<typeof updatePage>[1]);
  }, [updatePage]);

  /* ── Derived data for PDF preview ───────────────────────────────────────── */

  const pageUrlEntries = pdfPages.map((p) => ({
    id:                    p.id,
    position:              p.position,
    type:                  'pdf' as const,
    url:                   signedUrls[p.id] ?? null,
    title:                 p.title,
    indent:                p.indent,
    link_url:              p.link_url ?? undefined,
    link_label:            p.link_label ?? undefined,
    show_title:            p.show_title,
    show_member_badge:     p.show_member_badge,
    show_client_logo:      p.show_client_logo ?? false,
    prepared_by_member_id: p.prepared_by_member_id,
    payload:               p.payload as Record<string, unknown>,
  }));

  const pdfEntries = pdfPages.map((p) => ({
    name:       p.title,
    indent:     p.indent,
    link_url:   p.link_url ?? undefined,
    link_label: p.link_label ?? undefined,
  }));

  /* ── Feature flags ──────────────────────────────────────────────────────── */

  const pricingExists = pages.some((p) => p.type === 'pricing');
  const tocExists     = pages.some((p) => p.type === 'toc');

  /* ── Summary ────────────────────────────────────────────────────────────── */

  const summaryParts = [
    `${pdfPages.length} PDF page${pdfPages.length !== 1 ? 's' : ''}`,
    pricingExists                                          ? 'pricing'      : '',
    pages.filter((p) => p.type === 'packages').length > 0  ? `${pages.filter((p) => p.type === 'packages').length} packages` : '',
    pages.filter((p) => p.type === 'text').length > 0      ? `${pages.filter((p) => p.type === 'text').length} text`         : '',
    tocExists                                              ? 'contents'     : '',
  ].filter(Boolean);

  return {
    // Selection
    selectedId,
    setSelectedId,
    selectedPage,
    selectedPdfIdx,
    isReordering,
    setIsReordering,

    // Layout
    panelRef,
    panelHeight,

    // Navigation
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,

    // Insert handlers
    handleInsertPdf,
    handleInsertText,
    handleInsertPricing,
    handleAddPackages,
    handleAddSection,
    handleAddToc,

    // Delete / update
    handleDeletePage,
    handleTextPageUpdate,

    // Derived data
    pageUrlEntries,
    pdfEntries,
    pricingExists,
    tocExists,
    summaryParts,
  };
}
