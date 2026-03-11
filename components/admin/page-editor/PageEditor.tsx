// components/admin/page-editor/PageEditor.tsx
'use client';

import { useCallback } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Check, Loader2 } from 'lucide-react';

import type { PageEditorProps } from './pageEditorTypes';
import { usePageEditor } from './usePageEditor';
import type { EntityType } from './usePageEditor';
import { usePageEditorActions } from './usePageEditorActions';

import SortablePdfRow       from './SortablePdfRow';
import SortablePricingRow   from './SortablePricingRow';
import SortableTextRow      from './SortableTextRow';
import SortableGroupRow     from './SortableGroupRow';
import SortablePackagesRow  from './SortablePackagesRow';
import SortableTocRow       from './SortableTocRow';
import InsertPageMenu       from './InsertPageMenu';
import AddPageButtons       from './AddPageButtons';
import PreviewRouter        from './PreviewRouter';
import SplitPanelLayout     from '@/components/admin/shared/SplitPanelLayout';

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

  const editor = usePageEditor(proposalId, entityType);
  const {
    pages, pagesLoaded, saveStatuses, processing,
    pdfPages, updatePage, reorderPages, replacePdfPage, flushSaves,
  } = editor;

  const actions = usePageEditorActions(editor);
  const {
    selectedId, setSelectedId, selectedPage, selectedPdfIdx,
    isReordering, setIsReordering,
    panelRef, panelHeight,
    canGoPrev, canGoNext, goPrev, goNext,
    handleInsertPdf, handleInsertText, handleInsertPricing,
    handleAddPackages, handleAddSection, handleAddToc,
    handleDeletePage, handleTextPageUpdate,
    pageUrlEntries, pdfEntries,
    pricingExists, tocExists, summaryParts,
  } = actions;

  const isDocuments = entityType === 'document';

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
  }, [pages, processing, isReordering, reorderPages, setIsReordering]);

  /* ── Done ──────────────────────────────────────────────────────────────── */

  const handleDone = async () => {
    await flushSaves();
    onSave();
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  const pricingActive = pricingExists;

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

      {/* ── Add-page buttons ──────────────────────────────────────────── */}
      {pagesLoaded && (
        <AddPageButtons
          isDocuments={isDocuments}
          canAddPricing={!isDocuments && !pricingExists}
          canAddToc={!isDocuments && !tocExists}
          onAddPricing={handleInsertPricing}
          onAddPackages={handleAddPackages}
          onAddText={() => handleInsertText(null)}
          onAddSection={handleAddSection}
          onAddToc={handleAddToc}
        />
      )}

      <p className="text-xs text-gray-400 mb-4">
        Drag to reorder pages. Type a name for each page or leave blank for default numbering. Changes save automatically.
      </p>

      {/* ── 65/35 split ───────────────────────────────────────────────── */}
      <SplitPanelLayout
        containerRef={panelRef}
        panelHeight={panelHeight}
        leftClassName="overflow-hidden flex flex-col relative"
        rightClassName="flex flex-col"
        left={
          <>
            {(processing || isReordering) && (
              <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-sm border border-gray-200">
                  <Loader2 size={14} className="animate-spin text-[#017C87]" />
                  <span className="text-xs font-medium text-gray-600">Processing…</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
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
                          onToggleIndent={() => updatePage(page.id, { indent: page.indent ? 0 : 1 })}
                          onRemove={() => handleDeletePage(page.id)}
                          linkUrl={page.link_url ?? ''}
                          linkLabel={page.link_label ?? ''}
                          onLinkChange={(url, label) => updatePage(page.id, { link_url: url, link_label: label })}
                          renderInsertAfter={insertAfterMenu}
                        />
                      );
                    }

                    if (page.type === 'packages') {
                      return (
                        <SortablePackagesRow
                          key={page.id}
                          id={page.id}
                          title={page.title}
                          indent={page.indent}
                          isFirst={visualIdx === 0}
                          isSelected={selectedId === page.id}
                          onSelect={() => setSelectedId(page.id)}
                          onToggleIndent={() => updatePage(page.id, { indent: page.indent ? 0 : 1 })}
                          onRemove={() => handleDeletePage(page.id)}
                          linkUrl={page.link_url ?? ''}
                          linkLabel={page.link_label ?? ''}
                          onLinkChange={(url, label) => updatePage(page.id, { link_url: url, link_label: label })}
                          renderInsertAfter={insertAfterMenu}
                        />
                      );
                    }

                    if (page.type === 'text') {
                      return (
                        <SortableTextRow
                          key={page.id}
                          id={page.id}
                          title={page.title}
                          indent={page.indent}
                          isFirst={visualIdx === 0}
                          isSelected={selectedId === page.id}
                          saveStatus={saveStatuses[page.id] ?? 'idle'}
                          onSelect={() => setSelectedId(page.id)}
                          onToggleIndent={() => updatePage(page.id, { indent: page.indent ? 0 : 1 })}
                          onRemove={() => handleDeletePage(page.id)}
                          renderInsertAfter={insertAfterMenu}
                        />
                      );
                    }

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
                        onToggleIndent={() => updatePage(page.id, { indent: page.indent ? 0 : 1 })}
                        onUpdate={(changes) => updatePage(page.id, changes as Parameters<typeof updatePage>[1])}
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
          </>
        }
        right={
          <PreviewRouter
            proposalId={proposalId}
            filePath={filePath}
            selectedPage={selectedPage}
            selectedPdfIdx={selectedPdfIdx}
            saveStatuses={saveStatuses}
            pdfEntries={pdfEntries}
            pageUrlEntries={pageUrlEntries}
            pdfPageCount={pdfPages.length}
            onTextPageUpdate={handleTextPageUpdate}
            onGoPrev={goPrev}
            onGoNext={goNext}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
          />
        }
      />
    </div>
  );
}
