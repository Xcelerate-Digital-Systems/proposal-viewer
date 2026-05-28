// components/admin/page-editor/PageEditor.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import { useAuth } from '@/hooks/useAuth';
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
import ImportPagesModal     from './ImportPagesModal';
import SavePageToLibraryModal from './SavePageToLibraryModal';
import PreviewRouter        from './PreviewRouter';
import StickyPreviewAside   from '@/components/admin/shared/StickyPreviewAside';

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
  bottomContent,
}: PageEditorProps) {

  const entityType = tableName2EntityType(tableName);
  const { companyId } = useAuth();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<{ id: string; title: string; type: string } | null>(null);

  const editor = usePageEditor(proposalId, entityType);
  const {
    pages, pagesLoaded, saveStatuses, processing,
    pdfPages, updatePage, reorderPages, replacePdfPage, flushSaves,
  } = editor;

  // Aggregate per-page save status into a single tab-level status for the
  // detail header badge. Per-row badges remain in place where they apply.
  const aggregatedSaveStatus = useMemo(() => {
    const values = Object.values(saveStatuses);
    if (values.includes('saving')) return 'saving' as const;
    if (values.includes('saved')) return 'saved' as const;
    return 'idle' as const;
  }, [saveStatuses]);
  useReportSaveStatus(aggregatedSaveStatus);

  const actions = usePageEditorActions(editor);
  const {
    selectedId, setSelectedId, selectedPage, selectedPdfIdx,
    isReordering, setIsReordering,
    canGoPrev, canGoNext, goPrev, goNext,
    handleInsertPdf, handleInsertText, handleInsertPricing,
    handleAddPackages, handleAddSection, handleAddToc,
    handleDeletePage, handleTextPageUpdate,
    pageUrlEntries, pdfEntries,
    pricingExists, tocExists,
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

  // pricingExists kept for backward compat but no longer gates the add button

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {/* ── Header toolbar — Add Page actions on the left, Cancel/Done on the right.
          No outer card; the sub-nav already labels this view and the parent
          page wrapper supplies padding + scroll. Mirrors the Quote tab shell. */}
      {pagesLoaded && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <AddPageButtons
              isDocuments={isDocuments}
              canAddPricing={!isDocuments}
              canAddToc={!isDocuments && !tocExists}
              onAddPricing={handleInsertPricing}
              onAddPackages={handleAddPackages}
              onAddText={() => handleInsertText(null)}
              onAddSection={handleAddSection}
              onAddToc={handleAddToc}
              onImportFromTemplate={!isDocuments ? () => setImportModalOpen(true) : undefined}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-dim hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleDone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal text-white hover:bg-teal/90 transition-colors"
            >
              <Check size={12} />
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column: only the left column scrolls; the preview aside is
          stationary so the page-area header doesn't get scrolled past and
          we avoid nested scroll containers under <main>. */}
      <div className="flex-1 min-h-0 flex gap-6">
        <div className="flex-1 min-w-0 relative overflow-y-auto pr-2 -mr-2 space-y-5">
          {(processing || isReordering) && (
            <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-sm border border-edge-strong">
                <Loader2 size={14} className="animate-spin text-teal" />
                <span className="text-xs font-medium text-prose">Processing…</span>
              </div>
            </div>
          )}

          <div className="space-y-0.5">
              <InsertPageMenu
                label="Insert"
                isStart
                disabled={processing}
                showPricing={!isDocuments}
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
                          indent={page.indent}
                          isFirst={visualIdx === 0}
                          isSelected={selectedId === page.id}
                          onSelect={() => setSelectedId(page.id)}
                          onRename={(name) => updatePage(page.id, { title: name })}
                          onToggleIndent={() => updatePage(page.id, { indent: page.indent ? 0 : 1 })}
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
                          onSaveToLibrary={() => setLibraryTarget({ id: page.id, title: page.title, type: page.type })}
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
                          onSaveToLibrary={() => setLibraryTarget({ id: page.id, title: page.title, type: page.type })}
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
                          onSaveToLibrary={() => setLibraryTarget({ id: page.id, title: page.title, type: page.type })}
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
                        onSaveToLibrary={() => setLibraryTarget({ id: page.id, title: page.title, type: page.type })}
                        renderInsertAfter={insertAfterMenu}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>

              {!pagesLoaded && (
                <p className="text-sm text-faint py-4 text-center">Loading pages…</p>
              )}
            </div>
            {bottomContent}
        </div>

        <StickyPreviewAside sticky={false}>
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
        </StickyPreviewAside>
      </div>

      {companyId && (
        <ImportPagesModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          entityId={proposalId}
          entityType={entityType}
          companyId={companyId}
          onImported={() => editor.loadPages()}
        />
      )}

      {libraryTarget && (
        <SavePageToLibraryModal
          open={!!libraryTarget}
          onClose={() => setLibraryTarget(null)}
          pageId={libraryTarget.id}
          pageTitle={libraryTarget.title}
          pageType={libraryTarget.type as import('@/lib/page-operations').PageType}
          entityType={entityType}
        />
      )}
    </div>
  );
}
