// components/admin/page-editor/PageEditor.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Check, Loader2, Plus, DollarSign, Package,
  FileText, FolderOpen, List,
} from 'lucide-react';

import type { PageEditorProps, UnifiedPage } from './pageEditorTypes';
import { usePageEditor } from './usePageEditor';
import type { EntityType } from './usePageEditor';

import SortablePdfRow      from './SortablePdfRow';
import SortablePricingRow  from './SortablePricingRow';
import SortableTextRow     from './SortableTextRow';
import SortableGroupRow    from './SortableGroupRow';
import SortablePackagesRow from './SortablePackagesRow';
import SortableTocRow      from './SortableTocRow';
import InsertPageMenu      from './InsertPageMenu';
import PdfPreviewPanel     from './PdfPreviewPanel';
import PricingPreviewPanel from './PricingPreviewPanel';
import TextPagePreviewPanel from './TextPagePreviewPanel';
import PackagesPreviewPanel from './PackagesPreviewPanel';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function tableName2EntityType(t: PageEditorProps['tableName']): EntityType {
  if (t === 'documents') return 'document';
  if (t === 'templates') return 'template';
  return 'proposal';
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function PageEditor({
  proposalId,
  filePath = '',
  onSave,
  onCancel,
  tableName = 'proposals',
}: PageEditorProps) {

  const entityType = tableName2EntityType(tableName);

  const {
    pages,
    pagesLoaded,
    saveStatuses,
    processing,
    signedUrls,
    pdfPages,
    addPage,
    updatePage,
    deletePage,
    reorderPages,
    insertPdfPage,
    replacePdfPage,
    flushSaves,
  } = usePageEditor(proposalId, entityType);

  /* ── UI state ─────────────────────────────────────────────────────────── */

  const [selectedId, setSelectedId]         = useState<string>('');
  const [isReordering, setIsReordering]     = useState(false);
  const [panelHeight, setPanelHeight]       = useState(520);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-select first page once loaded
  useEffect(() => {
    if (pagesLoaded && pages.length > 0 && !selectedId) {
      setSelectedId(pages[0].id);
    }
  }, [pagesLoaded, pages, selectedId]);

  /* ── Panel height ─────────────────────────────────────────────────────── */

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

  /* ── DnD ──────────────────────────────────────────────────────────────── */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || processing || isReordering) return;

    const oldIdx = pages.findIndex((p) => p.id === active.id);
    const newIdx = pages.findIndex((p) => p.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(pages, oldIdx, newIdx);
    setIsReordering(true);
    try {
      await reorderPages(reordered.map((p) => p.id));
    } finally {
      setIsReordering(false);
    }
  }, [pages, processing, isReordering, reorderPages]);

  /* ── Insert handlers ──────────────────────────────────────────────────── */

  const insertAfterPosition = (page: UnifiedPage | null) =>
    page ? page.position : -1;

  const handleInsertPdf = useCallback(async (afterPage: UnifiedPage | null, file: File) => {
    const afterPos = insertAfterPosition(afterPage);
    const ok = await insertPdfPage(file, afterPos);
    // selection stays on current page; user can click the new one
    return ok;
  }, [insertPdfPage]);

  const handleInsertText = useCallback(async (afterPage: UnifiedPage | null) => {
    const newPage = await addPage('text', {
      title:    'New Text Page',
      position: afterPage ? afterPage.position + 1 : undefined,
    });
    if (newPage) setSelectedId(newPage.id);
  }, [addPage]);

  const handleInsertPricing = useCallback(async () => {
    const alreadyExists = pages.some((p) => p.type === 'pricing');
    if (alreadyExists) return;
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

  const handleDeletePage = useCallback(async (pageId: string) => {
    const currentIdx = pages.findIndex((p) => p.id === pageId);
    const deleted = await deletePage(pageId);
    if (deleted && selectedId === pageId) {
      // Select adjacent page
      const next = pages[currentIdx + 1] ?? pages[currentIdx - 1];
      setSelectedId(next?.id ?? '');
    }
  }, [pages, selectedId, deletePage]);

  /* ── Text page update (maps Partial<TextPageData> → updatePage) ─────── */

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

  /* ── Prev / next navigation ──────────────────────────────────────────── */

  const selectedIdx  = pages.findIndex((p) => p.id === selectedId);
  const canGoPrev    = selectedIdx > 0;
  const canGoNext    = selectedIdx < pages.length - 1;
  const goPrev       = () => { if (canGoPrev) setSelectedId(pages[selectedIdx - 1].id); };
  const goNext       = () => { if (canGoNext) setSelectedId(pages[selectedIdx + 1].id); };

  /* ── Derived: selected page ──────────────────────────────────────────── */

  const selectedPage    = pages.find((p) => p.id === selectedId) ?? null;
  const selectedPdfIdx  = selectedPage?.type === 'pdf'
    ? pdfPages.findIndex((p) => p.id === selectedId)
    : -1;

  /* ── Derived: pageUrls for PdfPreviewPanel ───────────────────────────── */

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
    prepared_by_member_id: p.prepared_by_member_id,
    payload:               p.payload as Record<string, unknown>,
  }));

  /* ── Derived: entries (PageNameEntry) for PdfPreviewPanel ───────────── */

  const pdfEntries = pdfPages.map((p) => ({
    name:       p.title,
    indent:     p.indent,
    link_url:   p.link_url ?? undefined,
    link_label: p.link_label ?? undefined,
  }));

  /* ── Feature flags ───────────────────────────────────────────────────── */

  const isDocuments      = entityType === 'document';
  const pricingExists    = pages.some((p) => p.type === 'pricing');
  const pricingActive    = pricingExists;
  const canAddPricing    = !isDocuments && !pricingExists;
  const tocExists        = pages.some((p) => p.type === 'toc');
  const canAddToc        = !isDocuments && !tocExists;

  /* ── Done ────────────────────────────────────────────────────────────── */

  const handleDone = async () => {
    await flushSaves();
    onSave();
  };

  /* ── Summary label ───────────────────────────────────────────────────── */

  const pdfCount  = pdfPages.length;
  const textCount = pages.filter((p) => p.type === 'text').length;
  const pkgCount  = pages.filter((p) => p.type === 'packages').length;
  const hasToc    = tocExists;

  const summaryParts = [
    `${pdfCount} PDF page${pdfCount !== 1 ? 's' : ''}`,
    pricingExists ? 'pricing' : '',
    pkgCount > 0  ? `${pkgCount} packages` : '',
    textCount > 0 ? `${textCount} text` : '',
    hasToc        ? 'contents' : '',
  ].filter(Boolean);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Page Editor</h3>
          <span className="text-xs text-gray-400">{summaryParts.join(' + ')}</span>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#017C87] text-white hover:bg-[#017C87]/90 transition-colors"
          >
            <Check size={12} />
            Done
          </button>
        </div>
      </div>

      {/* ── Add-page buttons ────────────────────────────────────────── */}
      {pagesLoaded && (
        <div className="flex flex-wrap gap-2 mb-3">
          {canAddPricing && (
            <button
              onClick={handleInsertPricing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
            >
              <DollarSign size={12} />
              Add Pricing Page
            </button>
          )}
          {!isDocuments && (
            <button
              onClick={handleAddPackages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
            >
              <Package size={12} />
              Add Packages Page
            </button>
          )}
          <button
            onClick={() => handleInsertText(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
          >
            <FileText size={12} />
            Add Text Page
          </button>
          <button
            onClick={handleAddSection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
          >
            <FolderOpen size={12} />
            Add Section Header
          </button>
          {canAddToc && (
            <button
              onClick={handleAddToc}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
            >
              <List size={12} />
              Add Contents Page
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">
        Drag to reorder pages. Type a name for each page or leave blank for default numbering. Changes save automatically.
      </p>

      {/* ── 50/50 split ─────────────────────────────────────────────── */}
      <div ref={panelRef} className="flex gap-6" style={{ height: panelHeight }}>

        {/* Left: sortable page list */}
        <div className="w-1/2 min-w-0 overflow-hidden flex flex-col relative">

          {/* Processing overlay */}
          {(processing || isReordering) && (
            <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-sm border border-gray-200">
                <Loader2 size={14} className="animate-spin text-[#017C87]" />
                <span className="text-xs font-medium text-gray-600">Processing…</span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">

            {/* Insert-at-start */}
            <InsertPageMenu
              label="Insert"
              isStart
              disabled={processing}
              showPricing={!isDocuments}
              pricingAlreadyExists={pricingActive}
              onInsertPdf={(file) => handleInsertPdf(null, file)}
              onInsertTextPage={() => handleInsertText(null)}
              onInsertPricingPage={handleInsertPricing}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pages.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {pages.map((page, visualIdx) => {
                  const insertAfterMenu = (
                    <InsertPageMenu
                      disabled={processing}
                      showPricing={!isDocuments}
                      pricingAlreadyExists={pricingActive}
                      onInsertPdf={(file) => handleInsertPdf(page, file)}
                      onInsertTextPage={() => handleInsertText(page)}
                      onInsertPricingPage={handleInsertPricing}
                    />
                  );

                  /* ── section ──────────────────────────────────────── */
                  if (page.type === 'section') {
                    return (
                      <SortableGroupRow
                        key={page.id}
                        id={page.id}
                        name={page.title}
                        isSelected={selectedId === page.id}
                        onSelect={() => setSelectedId(page.id)}
                        onRename={(name) => updatePage(page.id, { title: name })}
                        onRemove={() => handleDeletePage(page.id)}
                      />
                    );
                  }

                  /* ── toc ──────────────────────────────────────────── */
                  if (page.type === 'toc') {
                    return (
                      <SortableTocRow
                        key={page.id}
                        id={page.id}
                        title={page.title || 'Table of Contents'}
                        isSelected={selectedId === page.id}
                        onSelect={() => setSelectedId(page.id)}
                        renderInsertAfter={insertAfterMenu}
                      />
                    );
                  }

                  /* ── pricing ──────────────────────────────────────── */
                  if (page.type === 'pricing') {
                    return (
                      <SortablePricingRow
                        key={page.id}
                        id={page.id}
                        title={page.title}
                        indent={page.indent}
                        isFirst={visualIdx === 0}
                        isSelected={selectedId === page.id}
                        onSelect={() => setSelectedId(page.id)}
                        onToggleIndent={() =>
                          updatePage(page.id, { indent: page.indent ? 0 : 1 })
                        }
                        linkUrl={page.link_url ?? ''}
                        linkLabel={page.link_label ?? ''}
                        onLinkChange={(url, label) =>
                          updatePage(page.id, { link_url: url, link_label: label })
                        }
                        renderInsertAfter={insertAfterMenu}
                      />
                    );
                  }

                  /* ── packages ─────────────────────────────────────── */
                  if (page.type === 'packages') {
                    return (
                      <SortablePackagesRow
                        key={page.id}
                        id={page.id}
                        title={page.title}
                        indent={page.indent}
                        isFirst={visualIdx === 0}
                        isSelected={selectedId === page.id}
                        processing={isReordering || processing}
                        onSelect={() => setSelectedId(page.id)}
                        onToggleIndent={() =>
                          updatePage(page.id, { indent: page.indent ? 0 : 1 })
                        }
                        onRemove={() => handleDeletePage(page.id)}
                        renderInsertAfter={insertAfterMenu}
                      />
                    );
                  }

                  /* ── text ─────────────────────────────────────────── */
                  if (page.type === 'text') {
                    return (
                      <SortableTextRow
                        key={page.id}
                        id={page.id}
                        title={page.title}
                        indent={page.indent}
                        isFirst={visualIdx === 0}
                        isSelected={selectedId === page.id}
                        onSelect={() => setSelectedId(page.id)}
                        onToggleIndent={() =>
                          updatePage(page.id, { indent: page.indent ? 0 : 1 })
                        }
                        onRemove={() => handleDeletePage(page.id)}
                        linkUrl={page.link_url ?? ''}
                        linkLabel={page.link_label ?? ''}
                        onLinkChange={(url, label) =>
                          updatePage(page.id, { link_url: url, link_label: label })
                        }
                        renderInsertAfter={insertAfterMenu}
                      />
                    );
                  }

                  /* ── pdf ──────────────────────────────────────────── */
                  const pdfIdx = pdfPages.findIndex((p) => p.id === page.id);
                  return (
                    <SortablePdfRow
                      key={page.id}
                      id={page.id}
                      page={page}
                      visualNum={visualIdx + 1}
                      isSelected={selectedId === page.id}
                      status={
                        saveStatuses[page.id] === 'saving' || saveStatuses[page.id] === 'saved'
                          ? (saveStatuses[page.id] as 'saving' | 'saved')
                          : null
                      }
                      processing={processing}
                      pageCount={pdfPages.length}
                      index={pdfIdx}
                      onSelect={() => setSelectedId(page.id)}
                      onToggleIndent={() =>
                        updatePage(page.id, { indent: page.indent ? 0 : 1 })
                      }
                      onUpdate={(changes) =>
                        updatePage(page.id, changes as Parameters<typeof updatePage>[1])
                      }
                      onReplacePage={(file) => replacePdfPage(page.id, file)}
                      onDeletePage={() => handleDeletePage(page.id)}
                      renderInsertAfter={insertAfterMenu}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>

            {!pagesLoaded && (
              <p className="text-sm text-gray-400 py-4 text-center">Loading pages…</p>
            )}
          </div>
        </div>

        {/* Right: preview panel */}
        <div className="w-1/2 min-w-0 flex flex-col">
          {!selectedPage ? (
            <div className="flex-1 flex items-center justify-center text-gray-300 text-xs">
              Select a page to preview
            </div>

          ) : selectedPage.type === 'pricing' ? (
            <PricingPreviewPanel
              proposalId={proposalId}
              page={selectedPage}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />

          ) : selectedPage.type === 'packages' ? (
            <PackagesPreviewPanel
              proposalId={proposalId}
              page={selectedPage}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />

          ) : selectedPage.type === 'text' ? (
            <TextPagePreviewPanel
              proposalId={proposalId}
              page={selectedPage}
              saveStatus={saveStatuses[selectedPage.id] ?? 'idle'}
              onUpdate={handleTextPageUpdate}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />

          ) : selectedPage.type === 'toc' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              <List size={32} className="text-amber-400 mb-3" />
              <p className="text-sm font-medium text-amber-700">Table of Contents</p>
              <p className="text-xs text-amber-500 mt-1 max-w-[240px]">
                Drag to reposition. Configure content and styling in the Contents tab.
              </p>
            </div>

          ) : selectedPage.type === 'section' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              <FolderOpen size={32} className="text-amber-400 mb-3" />
              <p className="text-sm font-medium text-amber-700">Section Header</p>
              <p className="text-xs text-amber-500 mt-1 max-w-[240px]">
                Non-navigable group header. Pages below it appear as children in the sidebar.
              </p>
            </div>

          ) : (
            /* pdf */
            <PdfPreviewPanel
              filePath={filePath}
              pdfVersion={0}
              selectedPdfIndex={Math.max(0, selectedPdfIdx)}
              pageCount={pdfPages.length}
              entries={pdfEntries}
              pageUrls={pageUrlEntries}
              onDocLoadSuccess={() => {}}
              onGoPrev={goPrev}
              onGoNext={goNext}
            />
          )}
        </div>
      </div>
    </div>
  );
}