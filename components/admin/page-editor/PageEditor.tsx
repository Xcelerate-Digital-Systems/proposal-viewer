// components/admin/page-editor/PageEditor.tsx
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Check, Loader2, Plus, DollarSign, Package, FileText, FolderOpen } from 'lucide-react';
import { PageEditorProps, UnifiedItem } from './pageEditorTypes';
import { usePageEditorState } from './usePageEditorState';
import { usePricingState } from './usePricingState';
import { useTextPagesState } from './useTextPagesState';
import { usePdfOperations } from './usePdfOperations';
import SortablePdfRow from './SortablePdfRow';
import SortablePricingRow from './SortablePricingRow';
import SortableTextRow from './SortableTextRow';
import SortableGroupRow from './SortableGroupRow';
import PdfPreviewPanel from './PdfPreviewPanel';
import PricingPreviewPanel from './PricingPreviewPanel';
import TextPagePreviewPanel from './TextPagePreviewPanel';
import { usePackagesState } from './usePackagesState';
import SortablePackagesRow from './SortablePackagesRow';
import PackagesPreviewPanel from './PackagesPreviewPanel';
import InsertPageMenu from './InsertPageMenu';

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel, tableName = 'proposals' }: PageEditorProps) {
  // UI state
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [panelHeight, setPanelHeight] = useState(520);

  const panelRef = useRef<HTMLDivElement>(null);

  // Hooks
  const {
    entries, setEntries, pageCount, setPageCount,
    saveStatus, syncPageCount, updateEntry,
    flushPendingSaves, forceSaveEntries, remapSaveStatus,
    addGroup, removeGroup,
    } = usePageEditorState(proposalId, initialPageNames, tableName);

  const {
    pricingLoaded, pricingExists, pricingPosition, setPricingPosition,
    pricingIndent, setPricingIndent,
    pricingForm, pricingSaveStatus, updatePricing, flushPricingSave,
    addPricingPage, removePricingPage, savePricing,
    pricingLinkUrl, pricingLinkLabel, updatePricingLink,
  } = usePricingState(proposalId);

  const textPageEntityType = tableName === 'documents' ? 'document' as const : 'proposal' as const;

  const {
    textPagesLoaded, textPages, textPageSaveStatuses,
    updateTextPage, updateTextPagePosition, flushTextPageSaves,
    addTextPage, removeTextPage,
  } = useTextPagesState({
    entityId: proposalId,
    entityType: textPageEntityType,
  });

  const {
    packagesLoaded, packagesExists, packagesPosition, setPackagesPosition,
    packagesIndent, setPackagesIndent,
    packagesForm, packagesSaveStatus,
    updatePackages, flushPackagesSave,
    addPackagesPage, removePackagesPage, savePackages,
  } = usePackagesState(proposalId);


  const selectedPdfIndex = selectedId.startsWith('pdf-') ? parseInt(selectedId.replace('pdf-', '')) : -1;

  const {
    processing, pdfVersion,
    handleReplacePage, handleInsertPage, handleDeletePage, handleReorder,
  } = usePdfOperations({
    proposalId, tableName, initialPageNames, entries, setEntries,
    pageCount, setPageCount, selectedPdfIndex,
    setSelectedId, flushPendingSaves, remapSaveStatus,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ——— Computed unified items ——————————————————————————————————— */

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    // Build items from entries, separating groups from PDF pages
    const items: UnifiedItem[] = [];
    let pdfIdx = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].type === 'group') {
        items.push({ id: `group-${i}`, type: 'group', pdfIndex: -1, entryIndex: i });
      } else {
        items.push({ id: `pdf-${pdfIdx}`, type: 'pdf', pdfIndex: pdfIdx, entryIndex: i });
        pdfIdx++;
      }
    }

    // Insert pricing page at its position (relative to PDF pages)
    if (pricingExists && pricingForm.enabled) {
      // Count PDF items to find insert position
      let pdfCount = 0;
      let insertIdx = items.length;
      if (pricingPosition >= 0) {
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= pricingPosition) { insertIdx = i; break; }
          if (items[i].type === 'pdf') pdfCount++;
          insertIdx = i + 1;
        }
      }
      items.splice(insertIdx, 0, { id: 'pricing', type: 'pricing', pdfIndex: -1 });
    }

    // Insert packages page at its position
    if (packagesExists && packagesForm.enabled) {
      let pdfCount = 0;
      let insertIdx = items.length;
      if (packagesPosition >= 0) {
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= packagesPosition) { insertIdx = i; break; }
          if (items[i].type === 'pdf') pdfCount++;
          insertIdx = i + 1;
        }
      }
      items.splice(insertIdx, 0, { id: 'packages', type: 'packages', pdfIndex: -1 });
    }

    // Insert text pages at their positions
    for (const tp of textPages) {
      if (!tp.enabled) continue;
      const textItem: UnifiedItem = {
        id: `text-${tp.id}`,
        type: 'text',
        pdfIndex: -1,
        textPageId: tp.id,
      };
      if (tp.position === -1 || tp.position >= items.length) {
        items.push(textItem);
      } else {
        let pdfCount = 0;
        let insertAt = 0;
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= tp.position) {
            insertAt = i;
            break;
          }
          if (items[i].type === 'pdf') pdfCount++;
          insertAt = i + 1;
        }
        items.splice(insertAt, 0, textItem);
      }
    }

    return items;
  }, [entries, pricingExists, pricingForm.enabled, pricingPosition, packagesExists, packagesForm.enabled, packagesPosition, textPages]);

  const selectedIsPricing = selectedId === 'pricing';
  const selectedIsPackages = selectedId === 'packages';
  const selectedIsGroup = selectedId.startsWith('group-');
  const selectedTextPage = selectedId.startsWith('text-')
    ? textPages.find((tp) => tp.id === selectedId.replace('text-', ''))
    : null;

  /* ——— Measure panel height ————————————————————————————————————— */

  useEffect(() => {
    const measure = () => {
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        setPanelHeight(Math.max(400, window.innerHeight - rect.top - 32));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  /* ——— Label helpers ———————————————————————————————————————————— */

  const toggleIndent = (index: number) => {
    if (index === 0) return;
    if (entries[index]?.type === 'group') return; // groups can't be indented
    updateEntry(index, { indent: entries[index].indent === 0 ? 1 : 0 });
  };

  /* ——— Position calculation helpers ———————————————————————————— */

  /** Count PDF pages up to and including the given visual index in unifiedItems */
  const countPdfPagesUpTo = useCallback((afterVisualIdx: number): number => {
    let count = 0;
    for (let i = 0; i <= afterVisualIdx && i < unifiedItems.length; i++) {
      if (unifiedItems[i].type === 'pdf') count++;
    }
    return count;
  }, [unifiedItems]);

  /* ——— Insert-at-position handlers ———————————————————————————— */

  /** Insert a PDF page at a specific position in the unified list */
  const handleInsertPdfAtPosition = useCallback((afterVisualIdx: number, file: File) => {
    const afterPdfPage = afterVisualIdx === -1 ? 0 : countPdfPagesUpTo(afterVisualIdx);
    handleInsertPage(afterPdfPage, file);
  }, [countPdfPagesUpTo, handleInsertPage]);

  /** Insert a text page at a specific position in the unified list */
  const handleInsertTextPageAtPosition = useCallback(async (afterVisualIdx: number) => {
    const position = afterVisualIdx === -1 ? 0 : countPdfPagesUpTo(afterVisualIdx);
    const newPage = await addTextPage(position);
    if (newPage) setSelectedId(`text-${newPage.id}`);
  }, [countPdfPagesUpTo, addTextPage, setSelectedId]);

  /** Insert a pricing page (created at end, user can drag to position) */
  const handleInsertPricingAtPosition = useCallback(async () => {
    if (pricingExists && pricingForm.enabled) return;
    await addPricingPage();
    setSelectedId('pricing');
  }, [pricingExists, pricingForm.enabled, addPricingPage, setSelectedId]);

  /* ——— Drag and drop ——————————————————————————————————————————— */

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (processing) return; // Block reorder while a previous operation is in flight

    const oldIdx = unifiedItems.findIndex((i) => i.id === active.id);
    const newIdx = unifiedItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(unifiedItems, oldIdx, newIdx);

    // Extract new PDF page order (for physical PDF reorder)
    const pdfItems = reordered.filter((i) => i.type === 'pdf');
    const newPageOrder = pdfItems.map((i) => i.pdfIndex);

    // Helper: count PDF pages before a given index in the reordered list
    const countPdfBefore = (idx: number) =>
      reordered.slice(0, idx).filter((i) => i.type === 'pdf').length;

    // Update pricing position
    if (pricingExists && pricingForm.enabled) {
      const pricingIdx = reordered.findIndex((i) => i.type === 'pricing');
      const isLast = pricingIdx === reordered.length - 1;
      const newPos = isLast ? -1 : countPdfBefore(pricingIdx);
      if (newPos !== pricingPosition) {
        setPricingPosition(newPos);
        savePricing(pricingForm, newPos);
      }
    }

    // Update packages position
    if (packagesExists && packagesForm.enabled) {
      const packagesIdx = reordered.findIndex((i) => i.type === 'packages');
      if (packagesIdx !== -1) {
        const isLast = packagesIdx === reordered.length - 1;
        const newPos = isLast ? -1 : countPdfBefore(packagesIdx);
        if (newPos !== packagesPosition) {
          setPackagesPosition(newPos);
          savePackages(packagesForm, newPos);
        }
      }
    }

    // Update text page positions
    for (const tp of textPages) {
      if (!tp.enabled) continue;
      const textIdx = reordered.findIndex((i) => i.id === `text-${tp.id}`);
      if (textIdx === -1) continue;
      const isLast = textIdx === reordered.length - 1;
      const newPos = isLast ? -1 : countPdfBefore(textIdx);
      if (newPos !== tp.position) {
        updateTextPagePosition(tp.id, newPos);
      }
    }

    // Rebuild entries array from reordered items (groups + PDF entries in new visual order)
    // Only items that live in entries (pdf + group) are included; pricing/text are stored separately
    const newEntries: typeof entries = [];
    for (const item of reordered) {
      if ((item.type === 'pdf' || item.type === 'group') && item.entryIndex !== undefined) {
        newEntries.push(entries[item.entryIndex]);
      }
    }
    const entriesOrderChanged = newEntries.length !== entries.length || newEntries.some((e, i) => e !== entries[i]);
    if (entriesOrderChanged) {
      setEntries(newEntries);
      await forceSaveEntries(newEntries);
    }

    // Check if physical PDF order actually changed
    const orderChanged = newPageOrder.some((v, i) => v !== i);
    if (orderChanged) {
      await handleReorder(newPageOrder);
    }
  };

  /* ——— Add/remove pricing ————————————————————————————————————— */

  const handleAddPricing = async () => {
    await addPricingPage();
    setSelectedId('pricing');
  };

  const handleRemovePricing = async () => {
    const removed = await removePricingPage();
    if (removed) setSelectedId('pdf-0');
  };

  /* ——— Add/remove packages ————————————————————————————————————— */

  const handleAddPackages = async () => {
    await addPackagesPage();
    setSelectedId('packages');
  };

  const handleRemovePackages = async () => {
    const removed = await removePackagesPage();
    if (removed) setSelectedId('pdf-0');
  };

  const handleAddTextPage = async () => {
    const newPage = await addTextPage();
    if (newPage) {
      setSelectedId(`text-${newPage.id}`);
    }
  };

  const handleRemoveTextPage = async (pageId: string) => {
    const removed = await removeTextPage(pageId);
    if (removed) setSelectedId('pdf-0');
  };

  /* ——— Prev / Next navigation for preview panels ——————————————— */

  const selectedUnifiedIdx = unifiedItems.findIndex((i) => i.id === selectedId);
  const canGoPrev = selectedUnifiedIdx > 0;
  const canGoNext = selectedUnifiedIdx < unifiedItems.length - 1;
  const goPrev = () => { if (canGoPrev) setSelectedId(unifiedItems[selectedUnifiedIdx - 1].id); };
  const goNext = () => { if (canGoNext) setSelectedId(unifiedItems[selectedUnifiedIdx + 1].id); };

  /* ——— Done button: flush all pending saves ———————————————————— */

  const handleDone = async () => {
    await flushPendingSaves();
    await flushPricingSave();
    await flushTextPageSaves();
    onSave();
  };

  /* ——— Shared insert menu props ——————————————————————————————— */

  const isDocuments = tableName === 'documents';
  const pricingAlreadyActive = pricingExists && pricingForm.enabled;

  /* ——— Render ————————————————————————————————————————————————— */

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Page Editor</h3>
          <span className="text-xs text-gray-400">
            {pageCount} PDF page{pageCount !== 1 ? 's' : ''}
            {pricingExists && pricingForm.enabled ? ' + pricing' : ''}
            {textPages.filter((tp) => tp.enabled).length > 0
              ? ` + ${textPages.filter((tp) => tp.enabled).length} text`
              : ''}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {(pricingLoaded && packagesLoaded && textPagesLoaded) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {!isDocuments && (!pricingExists || !pricingForm.enabled) && (
            <button
              onClick={handleAddPricing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
            >
              <DollarSign size={12} />
              Add Pricing Page
            </button>
          )}
          {tableName !== 'documents' && (!packagesExists || !packagesForm.enabled) && (
            <button
              onClick={handleAddPackages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
            >
              <Package size={12} />
              Add Packages Page
            </button>
          )}
          <button
            onClick={handleAddTextPage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
          >
            <FileText size={12} />
            Add Text Page
          </button>
          <button
            onClick={() => addGroup('New Section')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
          >
            <FolderOpen size={12} />
            Add Section Header
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">
        Drag to reorder pages. Type a name for each page or leave blank for default numbering. Changes save automatically.
      </p>

      {/* 50/50 split */}
      <div ref={panelRef} className="flex gap-6" style={{ height: panelHeight }}>
        {/* Left half: sortable page list */}
        <div className="w-1/2 min-w-0 overflow-hidden flex flex-col relative">
          {/* Processing overlay — blocks interaction during PDF operations */}
          {processing && (
            <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-sm border border-gray-200">
                <Loader2 size={14} className="animate-spin text-[#017C87]" />
                <span className="text-xs font-medium text-gray-600">Processing…</span>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
            {/* Insert-at-start menu */}
            <InsertPageMenu
              label="Insert"
              isStart
              disabled={processing}
              showPricing={!isDocuments}
              pricingAlreadyExists={pricingAlreadyActive}
              onInsertPdf={(file) => handleInsertPage(0, file)}
              onInsertTextPage={() => handleInsertTextPageAtPosition(-1)}
              onInsertPricingPage={handleInsertPricingAtPosition}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={unifiedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {unifiedItems.map((item, visualIdx) => {
                  if (item.type === 'pricing') {
                    return (
                      <SortablePricingRow
                        key={item.id}
                        id={item.id}
                        title={pricingForm.title}
                        indent={pricingIndent}
                        isFirst={visualIdx === 0}
                        isSelected={selectedIsPricing}
                        onSelect={() => setSelectedId('pricing')}
                        onToggleIndent={() => {
                          const next = pricingIndent ? 0 : 1;
                          setPricingIndent(next);
                          savePricing(pricingForm, pricingPosition, next);
                        }}
                        linkUrl={pricingLinkUrl}
                        linkLabel={pricingLinkLabel}
                        onLinkChange={(url: string, label: string) => updatePricingLink(url, label)}
                        renderInsertAfter={
                          <InsertPageMenu
                            disabled={processing}
                            showPricing={!isDocuments}
                            pricingAlreadyExists={pricingAlreadyActive}
                            onInsertPdf={(file) => handleInsertPdfAtPosition(visualIdx, file)}
                            onInsertTextPage={() => handleInsertTextPageAtPosition(visualIdx)}
                            onInsertPricingPage={handleInsertPricingAtPosition}
                          />
                        }
                      />
                    );
                  }

                  if (item.type === 'packages') {
                    return (
                      <SortablePackagesRow
                        key={item.id}
                        id={item.id}
                        title={packagesForm.title}
                        indent={packagesIndent}
                        isFirst={visualIdx === 0}
                        isSelected={selectedIsPackages}
                        onSelect={() => setSelectedId('packages')}
                        onToggleIndent={() => {
                          const next = packagesIndent ? 0 : 1;
                          setPackagesIndent(next);
                          savePackages(packagesForm, packagesPosition, next);
                        }}
                      />
                    );
                  }

                  if (item.type === 'text') {
                    const tp = textPages.find((t) => t.id === item.textPageId);
                    return (
                      <SortableTextRow
                        key={item.id}
                        id={item.id}
                        title={tp?.title || 'Text Page'}
                        indent={tp?.indent ?? 0}
                        isFirst={visualIdx === 0}
                        isSelected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onToggleIndent={() => {
                          if (tp) updateTextPage(tp.id, { indent: tp.indent ? 0 : 1 });
                        }}
                        onRemove={() => tp && handleRemoveTextPage(tp.id)}
                        linkUrl={tp?.link_url || ''}
                        linkLabel={tp?.link_label || ''}
                        onLinkChange={(url: string, label: string) => {
                          if (tp) updateTextPage(tp.id, { link_url: url, link_label: label });
                        }}
                        renderInsertAfter={
                          <InsertPageMenu
                            disabled={processing}
                            showPricing={!isDocuments}
                            pricingAlreadyExists={pricingAlreadyActive}
                            onInsertPdf={(file) => handleInsertPdfAtPosition(visualIdx, file)}
                            onInsertTextPage={() => handleInsertTextPageAtPosition(visualIdx)}
                            onInsertPricingPage={handleInsertPricingAtPosition}
                          />
                        }
                      />
                    );
                  }

                  if (item.type === 'group') {
                    const entryIdx = item.entryIndex!;
                    const entry = entries[entryIdx];
                    if (!entry) return null;
                    return (
                      <SortableGroupRow
                        key={item.id}
                        id={item.id}
                        name={entry.name}
                        isSelected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onRename={(name) => updateEntry(entryIdx, { name })}
                        onRemove={() => removeGroup(entryIdx)}
                      />
                    );
                  }

                  const entryIdx = item.entryIndex ?? item.pdfIndex;
                  const entry = entries[entryIdx];
                  if (!entry) return null;
                  const i = item.pdfIndex;

                  return (
                    <SortablePdfRow
                      key={item.id}
                      id={item.id}
                      entry={entry}
                      visualNum={visualIdx + 1}
                      isSelected={selectedId === item.id}
                      status={saveStatus[entryIdx] === 'saving' || saveStatus[entryIdx] === 'saved' ? saveStatus[entryIdx] : null}
                      processing={processing}
                      pageCount={pageCount}
                      index={i}
                      onSelect={() => setSelectedId(item.id)}
                      onToggleIndent={() => toggleIndent(entryIdx)}
                      onUpdateEntry={(changes) => updateEntry(entryIdx, changes)}
                      onReplacePage={(file) => handleReplacePage(i, file)}
                      onDeletePage={() => handleDeletePage(i)}
                      renderInsertAfter={
                        <InsertPageMenu
                          disabled={processing}
                          showPricing={!isDocuments}
                          pricingAlreadyExists={pricingAlreadyActive}
                          onInsertPdf={(file) => handleInsertPdfAtPosition(visualIdx, file)}
                          onInsertTextPage={() => handleInsertTextPageAtPosition(visualIdx)}
                          onInsertPricingPage={handleInsertPricingAtPosition}
                        />
                      }
                    />
                  );
                })}
              </SortableContext>
            </DndContext>

            {entries.length === 0 && <p className="text-sm text-gray-400">Loading pages...</p>}
          </div>
        </div>

        {/* Right half: preview / editor */}
        <div className="w-1/2 min-w-0 flex flex-col">
          {selectedIsPricing && pricingExists ? (
            <PricingPreviewPanel
              proposalId={proposalId}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />
          ) : selectedIsPackages && packagesExists ? (
            <PackagesPreviewPanel
              proposalId={proposalId}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />
          ) : selectedTextPage ? (
            <TextPagePreviewPanel
              proposalId={proposalId}
              page={selectedTextPage}
              saveStatus={textPageSaveStatuses[selectedTextPage.id] || 'idle'}
              onUpdate={(pageId: string, changes) => updateTextPage(pageId, changes)}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />
          ) : selectedIsGroup ? (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              Section headers are visual dividers in the sidebar navigation.
            </div>
          ) : (
            <PdfPreviewPanel
              filePath={filePath}
              pdfVersion={pdfVersion}
              selectedPdfIndex={selectedPdfIndex}
              pageCount={pageCount}
              entries={entries}
              onDocLoadSuccess={(data) => syncPageCount(data.numPages)}
              onGoPrev={goPrev}
              onGoNext={goNext}
            />
          )}
        </div>
      </div>
    </div>
  );
}