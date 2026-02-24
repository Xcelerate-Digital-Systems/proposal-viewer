// components/admin/page-editor/PageEditor.tsx
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Check, Loader2, Plus, DollarSign, FileText, FolderOpen } from 'lucide-react';

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

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel, tableName = 'proposals' }: PageEditorProps) {
  // UI state
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [panelHeight, setPanelHeight] = useState(520);

  const panelRef = useRef<HTMLDivElement>(null);

  // Hooks
  const {
    entries, setEntries, pageCount, setPageCount,
    saveStatus, syncPageCount, updateEntry,
    flushPendingSaves, remapSaveStatus,
    addGroup, removeGroup,
    } = usePageEditorState(proposalId, initialPageNames, tableName);

  const {
    pricingLoaded, pricingExists, pricingPosition, setPricingPosition,
    pricingIndent, setPricingIndent,
    pricingForm, pricingSaveStatus, updatePricing, flushPricingSave,
    addPricingPage, removePricingPage, savePricing,
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
  }, [entries, pricingExists, pricingForm.enabled, pricingPosition, textPages]);

  const selectedIsPricing = selectedId === 'pricing';
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

  /* ——— Drag and drop ——————————————————————————————————————————— */

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

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
      await flushPendingSaves();
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

  /* ——— Add/remove text pages ————————————————————————————————— */

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

  /* ——— Navigation ————————————————————————————————————————————— */

  const goPrev = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx > 0) setSelectedId(unifiedItems[idx - 1].id);
  };
  const goNext = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx < unifiedItems.length - 1) setSelectedId(unifiedItems[idx + 1].id);
  };

  // Compute nav availability
  const selectedUnifiedIdx = unifiedItems.findIndex((i) => i.id === selectedId);
  const canGoPrev = selectedUnifiedIdx > 0;
  const canGoNext = selectedUnifiedIdx < unifiedItems.length - 1;

  /* ——— Done —————————————————————————————————————————————————— */

  const handleDone = async () => {
    await flushPendingSaves();
    await flushPricingSave();
    await flushTextPageSaves();
    onSave();
  };

  /* ——— Render ———————————————————————————————————————————————— */

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-900">Edit Pages</h4>
          {processing && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin text-[#017C87]" />
              Processing...
            </div>
          )}
        </div>
        <button
          onClick={handleDone}
          disabled={processing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
        >
          <Check size={14} />
          Done
        </button>
      </div>

      {/* Action buttons */}
      {(pricingLoaded && textPagesLoaded) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tableName !== 'documents' && (!pricingExists || !pricingForm.enabled) && (
            <button
              onClick={handleAddPricing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
            >
              <DollarSign size={12} />
              Add Pricing Page
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
        <div className="w-1/2 min-w-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
            {/* Insert-at-start button */}
            <div className="flex justify-center py-1">
              <label
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] transition-colors ${
                  processing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
                }`}
                title="Insert page at start"
              >
                <Plus size={10} /> Insert
                <input type="file" accept=".pdf" className="hidden" disabled={processing}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInsertPage(0, f); e.target.value = ''; }}
                />
              </label>
            </div>

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
                    <div key={item.id}>
                      <SortablePdfRow
                        id={item.id}
                        entry={entry}
                        visualNum={visualIdx + 1}
                        isSelected={selectedId === item.id}
                        status={saveStatus[entryIdx] || null}
                        processing={processing}
                        pageCount={pageCount}
                        index={i}
                        onSelect={() => setSelectedId(item.id)}
                        onToggleIndent={() => toggleIndent(entryIdx)}
                        onUpdateEntry={(changes) => updateEntry(entryIdx, changes)}
                        onReplacePage={(file) => handleReplacePage(i, file)}
                        onDeletePage={() => handleDeletePage(i)}
                      />

                      {/* Insert-after button */}
                      <div className="flex justify-center py-1">
                        <label
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] transition-colors ${
                            processing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
                          }`}
                          title={`Insert page after page ${i + 1}`}
                        >
                          <Plus size={10} /> Insert
                          <input type="file" accept=".pdf" className="hidden" disabled={processing}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInsertPage(i + 1, f); e.target.value = ''; }}
                          />
                        </label>
                      </div>
                    </div>
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
          ) : selectedTextPage ? (
            <TextPagePreviewPanel
              proposalId={proposalId}
              page={selectedTextPage}
              saveStatus={textPageSaveStatuses[selectedTextPage.id] || 'idle'}
              onUpdate={updateTextPage}
              onGoPrev={goPrev}
              onGoNext={goNext}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
            />
          ) : selectedIsGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              <FolderOpen size={32} className="text-amber-400 mb-3" />
              <p className="text-sm font-medium text-amber-700">Section Header</p>
              <p className="text-xs text-amber-500 mt-1 max-w-[240px]">
                This is a non-navigable group header. Pages nested below it will appear as children in the sidebar.
              </p>
            </div>
          ) : (
            <PdfPreviewPanel
              filePath={filePath}
              pdfVersion={pdfVersion}
              selectedPdfIndex={selectedPdfIndex}
              pageCount={pageCount}
              entries={entries}
              onDocLoadSuccess={({ numPages }) => syncPageCount(numPages)}
              onGoPrev={goPrev}
              onGoNext={goNext}
            />
          )}
        </div>
      </div>
    </div>
  );
}