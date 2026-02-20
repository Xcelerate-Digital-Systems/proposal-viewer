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
import { Check, Loader2, Plus, DollarSign } from 'lucide-react';

import { PageEditorProps, UnifiedItem, CUSTOM_VALUE } from './pageEditorTypes';
import { usePageEditorState } from './usePageEditorState';
import { usePricingState } from './usePricingState';
import { usePdfOperations } from './usePdfOperations';
import SortablePdfRow from './SortablePdfRow';
import SortablePricingRow from './SortablePricingRow';
import PdfPreviewPanel from './PdfPreviewPanel';
import PricingPanel from './PricingPanel';

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel }: PageEditorProps) {
  // UI state
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [panelHeight, setPanelHeight] = useState(520);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hooks
  const {
    entries, setEntries, pageCount, setPageCount,
    saveStatus, syncPageCount, updateEntry,
    flushPendingSaves, remapSaveStatus,
  } = usePageEditorState(proposalId, initialPageNames);

  const {
    pricingLoaded, pricingExists, pricingPosition, setPricingPosition,
    pricingForm, pricingSaveStatus, updatePricing, flushPricingSave,
    addPricingPage, removePricingPage, savePricing,
  } = usePricingState(proposalId);

  const selectedPdfIndex = selectedId === 'pricing' ? -1 : parseInt(selectedId.replace('pdf-', ''));

  const {
    processing, pdfVersion,
    handleReplacePage, handleInsertPage, handleDeletePage, handleReorder,
  } = usePdfOperations({
    proposalId, initialPageNames, entries, setEntries,
    pageCount, setPageCount, selectedPdfIndex,
    setSelectedId, flushPendingSaves, remapSaveStatus,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ─── Computed unified items ─────────────────────────────────────── */

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = entries.map((_, i) => ({
      id: `pdf-${i}`,
      type: 'pdf' as const,
      pdfIndex: i,
    }));

    if (pricingExists && pricingForm.enabled) {
      const insertIdx = pricingPosition === -1 || pricingPosition >= items.length
        ? items.length
        : pricingPosition;
      items.splice(insertIdx, 0, { id: 'pricing', type: 'pricing', pdfIndex: -1 });
    }

    return items;
  }, [entries, pricingExists, pricingForm.enabled, pricingPosition]);

  const selectedIsPricing = selectedId === 'pricing';

  /* ─── Measure panel height ───────────────────────────────────────── */

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

  /* ─── Close dropdown on outside click ────────────────────────────── */

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ─── Label helpers ──────────────────────────────────────────────── */

  const selectPreset = (index: number, label: string) => {
    if (label !== CUSTOM_VALUE) updateEntry(index, { name: label });
    setOpenDropdown(null);
  };

  const toggleIndent = (index: number) => {
    if (index === 0) return;
    updateEntry(index, { indent: entries[index].indent === 0 ? 1 : 0 });
  };

  /* ─── Drag and drop ──────────────────────────────────────────────── */

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = unifiedItems.findIndex((i) => i.id === active.id);
    const newIdx = unifiedItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(unifiedItems, oldIdx, newIdx);

    // Extract new PDF page order
    const pdfItems = reordered.filter((i) => i.type === 'pdf');
    const newPageOrder = pdfItems.map((i) => i.pdfIndex);

    // Compute new pricing position
    if (pricingExists && pricingForm.enabled) {
      const pricingIdx = reordered.findIndex((i) => i.type === 'pricing');
      const pdfBeforePricing = reordered.slice(0, pricingIdx).filter((i) => i.type === 'pdf').length;
      const isLast = pricingIdx === reordered.length - 1;
      const newPos = isLast ? -1 : pdfBeforePricing;
      if (newPos !== pricingPosition) {
        setPricingPosition(newPos);
        savePricing(pricingForm, newPos);
      }
    }

    // Check if PDF order actually changed
    const orderChanged = newPageOrder.some((v, i) => v !== i);
    if (orderChanged) {
      await handleReorder(newPageOrder);
    }
  };

  /* ─── Add/remove pricing ─────────────────────────────────────────── */

  const handleAddPricing = async () => {
    await addPricingPage();
    setSelectedId('pricing');
  };

  const handleRemovePricing = async () => {
    const removed = await removePricingPage();
    if (removed) setSelectedId('pdf-0');
  };

  /* ─── Navigation ─────────────────────────────────────────────────── */

  const goPrev = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx > 0) setSelectedId(unifiedItems[idx - 1].id);
  };
  const goNext = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx < unifiedItems.length - 1) setSelectedId(unifiedItems[idx + 1].id);
  };

  /* ─── Done ───────────────────────────────────────────────────────── */

  const handleDone = async () => {
    await flushPendingSaves();
    await flushPricingSave();
    onSave();
  };

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      <p className="text-xs text-gray-400 mb-4">
        Drag to reorder pages. Choose a label from the dropdown or select &quot;Custom&quot; to type your own. Changes save automatically.
      </p>

      {/* 50/50 split */}
      <div ref={panelRef} className="flex gap-6" style={{ height: panelHeight }}>
        {/* Left half: sortable page list */}
        <div className="w-1/2 min-w-0 overflow-hidden flex flex-col" ref={dropdownRef}>
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
                        isSelected={selectedIsPricing}
                        onSelect={() => setSelectedId('pricing')}
                      />
                    );
                  }

                  const entry = entries[item.pdfIndex];
                  if (!entry) return null;
                  const i = item.pdfIndex;

                  return (
                    <div key={item.id}>
                      <SortablePdfRow
                        id={item.id}
                        entry={entry}
                        visualNum={visualIdx + 1}
                        isSelected={selectedId === item.id}
                        isDropdownOpen={openDropdown === i}
                        status={saveStatus[i] || null}
                        processing={processing}
                        pageCount={pageCount}
                        index={i}
                        onSelect={() => setSelectedId(item.id)}
                        onToggleIndent={() => toggleIndent(i)}
                        onUpdateEntry={(changes) => updateEntry(i, changes)}
                        onOpenDropdown={(open) => setOpenDropdown(open ? i : null)}
                        onSelectPreset={(label) => selectPreset(i, label)}
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

            {/* Add pricing page button */}
            {pricingLoaded && (!pricingExists || !pricingForm.enabled) && (
              <div className="flex justify-center pt-3 pb-2">
                <button
                  onClick={handleAddPricing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
                >
                  <DollarSign size={12} />
                  Add Pricing Page
                </button>
              </div>
            )}

            {entries.length === 0 && <p className="text-sm text-gray-400">Loading pages...</p>}
          </div>
        </div>

        {/* Right half: preview or pricing editor */}
        <div className="w-1/2 min-w-0 flex flex-col">
          {selectedIsPricing && pricingExists ? (
            <PricingPanel
              pricingForm={pricingForm}
              pricingSaveStatus={pricingSaveStatus}
              onUpdate={updatePricing}
              onRemove={handleRemovePricing}
            />
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