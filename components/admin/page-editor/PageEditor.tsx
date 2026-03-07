// components/admin/page-editor/PageEditor.tsx
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Check, Loader2, Plus, DollarSign, Package, FileText, FolderOpen, List } from 'lucide-react';
import { PageEditorProps, UnifiedItem } from './pageEditorTypes';
import { PageOrderEntry, TocSettings, DEFAULT_TOC_SETTINGS, parseTocSettings } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
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
import SortableTocRow from './SortableTocRow';
import InsertPageMenu from './InsertPageMenu';

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel, tableName = 'proposals' }: PageEditorProps) {
  // UI state
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [panelHeight, setPanelHeight] = useState(520);
  const [isReordering, setIsReordering] = useState(false);
  const [pageOrderVersion, setPageOrderVersion] = useState(0);

  // TOC settings — fetched from DB so we can show/position it in the editor list
  const [tocSettings, setTocSettings] = useState<TocSettings>(DEFAULT_TOC_SETTINGS);
  const [tocLoaded, setTocLoaded] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch toc_settings so we can show the TOC as a row in the page list
  useEffect(() => {
    const table = tableName === 'documents' ? 'documents' : 'proposals';
    supabase
      .from(table)
      .select('toc_settings')
      .eq('id', proposalId)
      .single()
      .then(({ data }) => {
        if (data) setTocSettings(parseTocSettings(data.toc_settings));
        setTocLoaded(true);
      });
  }, [proposalId, tableName]);

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
    packagesLoaded, packagesPages, packagesSaveStatuses,
    updatePackagesPage, updatePackagesPagePosition, flushPackagesSaves,
    addPackagesPage, removePackagesPage,
  } = usePackagesState(proposalId);

  // Save updated TOC position back to the entity's toc_settings JSONB
  const saveTocPosition = useCallback(async (position: number) => {
    const table = tableName === 'documents' ? 'documents' : 'proposals';
    const updated: TocSettings = { ...tocSettings, position };
    setTocSettings(updated);
    await supabase.from(table).update({ toc_settings: updated }).eq('id', proposalId);
  }, [proposalId, tableName, tocSettings]);

  const selectedPdfIndex = selectedId.startsWith('pdf-') ? parseInt(selectedId.replace('pdf-', '')) : -1;

  const {
    processing, pdfVersion, pageUrls,
    handleReplacePage, handleInsertPage, handleDeletePage, handleReorder,
  } = usePdfOperations({
    proposalId, tableName, initialPageNames, entries, setEntries,
    pageCount, setPageCount, selectedPdfIndex,
    setSelectedId, flushPendingSaves, remapSaveStatus,
  });

  // When page_names is empty (e.g. a freshly uploaded document) but pageUrls
  // has loaded from document_pages / proposal_pages, seed entries from the
  // page count. Without this, the sidebar shows "Loading pages..." forever
  // because syncPageCount is a no-op in per-page mode (PdfPreviewPanel never
  // fires onDocLoadSuccess when pageUrls are present).
  useEffect(() => {
    if (pageUrls.length > 0 && entries.filter((e) => e.type !== 'group').length === 0) {
      syncPageCount(pageUrls.length);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageUrls.length]);


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ——— Computed unified items ——————————————————————————————————— */

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
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

    // Insert each enabled packages page at its position
    const sortedPkgs = packagesPages
      .filter((p) => p.enabled)
      .sort((a, b) => a.position !== b.position ? a.position - b.position : (a.sort_order ?? 0) - (b.sort_order ?? 0));

    // AFTER
    for (const pkg of sortedPkgs) {
      let pdfCount = 0;
      let insertIdx = items.length;
      if (pkg.position >= 0) {
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= pkg.position) { insertIdx = i; break; }
          if (items[i].type === 'pdf') pdfCount++;
          insertIdx = i + 1;
        }
        // Advance past packages already spliced in at this same boundary
        while (insertIdx < items.length && items[insertIdx].type === 'packages') {
          insertIdx++;
        }
      }
      items.splice(insertIdx, 0, { id: `packages-${pkg.id}`, type: 'packages', pdfIndex: -1, packagesId: pkg.id });
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

    // Insert TOC page at its position when enabled
    if (tocSettings.enabled) {
      const tocPosition = tocSettings.position;
      let pdfCount = 0;
      let insertIdx = items.length;
      if (tocPosition >= 0) {
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= tocPosition) { insertIdx = i; break; }
          if (items[i].type === 'pdf') pdfCount++;
          insertIdx = i + 1;
        }
      }
      items.splice(insertIdx, 0, { id: 'toc', type: 'toc', pdfIndex: -1 });
    }

    return items;
  }, [entries, pricingExists, pricingForm.enabled, pricingPosition, packagesPages, textPages, tocSettings]);

  const selectedIsPricing = selectedId === 'pricing';
  const selectedIsToc = selectedId === 'toc';
  const selectedIsPackages = selectedId.startsWith('packages-');
  const selectedPackagesId = selectedIsPackages ? selectedId.replace('packages-', '') : null;
  const selectedPackagesPage = selectedPackagesId ? packagesPages.find((p) => p.id === selectedPackagesId) ?? null : null;
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
    if (entries[index]?.type === 'group') return;
    updateEntry(index, { indent: entries[index].indent === 0 ? 1 : 0 });
  };

  /* ——— Position calculation helpers ———————————————————————————— */

  const countPdfPagesUpTo = useCallback((afterVisualIdx: number): number => {
    let count = 0;
    for (let i = 0; i <= afterVisualIdx && i < unifiedItems.length; i++) {
      if (unifiedItems[i].type === 'pdf') count++;
    }
    return count;
  }, [unifiedItems]);

  /* ——— Insert-at-position handlers ———————————————————————————— */

  const handleInsertPdfAtPosition = useCallback((afterVisualIdx: number, file: File) => {
    const afterPdfPage = afterVisualIdx === -1 ? 0 : countPdfPagesUpTo(afterVisualIdx);
    handleInsertPage(afterPdfPage, file);
  }, [countPdfPagesUpTo, handleInsertPage]);

  const handleInsertTextPageAtPosition = useCallback(async (afterVisualIdx: number) => {
    const position = afterVisualIdx === -1 ? 0 : countPdfPagesUpTo(afterVisualIdx);
    const newPage = await addTextPage(position);
    if (newPage) setSelectedId(`text-${newPage.id}`);
  }, [countPdfPagesUpTo, addTextPage, setSelectedId]);

  const handleInsertPricingAtPosition = useCallback(async () => {
    if (pricingExists && pricingForm.enabled) return;
    await addPricingPage();
    setSelectedId('pricing');
  }, [pricingExists, pricingForm.enabled, addPricingPage, setSelectedId]);

  /* ——— Drag and drop ——————————————————————————————————————————— */


  /* ——— page_order helpers ————————————————————————————————————— */

  const buildPageOrderFromItems = (items: UnifiedItem[]): PageOrderEntry[] =>
    items
      .filter((i) => i.type !== 'group')
      .map((i): PageOrderEntry | null => {
        if (i.type === 'pdf') return { type: 'pdf' };
        if (i.type === 'pricing') return { type: 'pricing' };
        if (i.type === 'packages' && i.packagesId) return { type: 'packages', id: i.packagesId };
        if (i.type === 'text' && i.textPageId) return { type: 'text', id: i.textPageId };
        if (i.type === 'toc') return { type: 'toc' };
        return null;
      })
      .filter((e): e is PageOrderEntry => e !== null);

  const savePageOrder = useCallback(async (items: UnifiedItem[]) => {
    const apiPath = tableName === 'documents' ? '/api/documents' : '/api/proposals';
    const pageOrder = buildPageOrderFromItems(items);
    await fetch(apiPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: proposalId, page_order: pageOrder }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, tableName]);

  // Save page_order whenever add/remove operations settle (version bump triggers this).
  // Drag-and-drop saves directly via savePageOrder(reordered) instead.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (pageOrderVersion === 0) return;
    savePageOrder(unifiedItems);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOrderVersion]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (processing) return;

    setIsReordering(true);
    try {
      const oldIdx = unifiedItems.findIndex((i) => i.id === active.id);
      const newIdx = unifiedItems.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(unifiedItems, oldIdx, newIdx);

      const pdfItems = reordered.filter((i) => i.type === 'pdf');
      const newPageOrder = pdfItems.map((i) => i.pdfIndex);

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

      // Update position for each packages page
      // AFTER
      // Update position for each packages page
      const pkgPositions = new Map<string, number>();
      for (const pkg of packagesPages.filter((p) => p.enabled)) {
        const pkgIdx = reordered.findIndex((i) => i.id === `packages-${pkg.id}`);
        if (pkgIdx === -1) continue;
        const isLast = pkgIdx === reordered.length - 1;
        const newPos = isLast ? -1 : countPdfBefore(pkgIdx);
        pkgPositions.set(pkg.id, newPos);
        if (newPos !== pkg.position) {
          updatePackagesPagePosition(pkg.id, newPos);
        }
      }
      // Update sort_order for packages sharing the same position
      const byPos2 = new Map<number, Array<{ id: string; idx: number }>>();
      for (const pkg of packagesPages.filter((p) => p.enabled)) {
        const pkgIdx = reordered.findIndex((i) => i.id === `packages-${pkg.id}`);
        if (pkgIdx === -1) continue;
        const pos = pkgPositions.get(pkg.id) ?? pkg.position;
        const arr = byPos2.get(pos) ?? [];
        arr.push({ id: pkg.id, idx: pkgIdx });
        byPos2.set(pos, arr);
      }
      for (const group of Array.from(byPos2.values())) {
        if (group.length < 2) continue;
        group.sort((a: { id: string; idx: number }, b: { id: string; idx: number }) => a.idx - b.idx);
        group.forEach(({ id }: { id: string }, i: number) => {
          const pkg = packagesPages.find((p) => p.id === id);
          if (pkg && (pkg.sort_order ?? 0) !== i) {
            updatePackagesPage(id, { sort_order: i });
          }
        });
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

      // Update TOC position if it was dragged
      if (tocSettings.enabled) {
        const tocIdx = reordered.findIndex((i) => i.id === 'toc');
        if (tocIdx !== -1) {
          const isLast = tocIdx === reordered.length - 1;
          const newPos = isLast ? -1 : countPdfBefore(tocIdx);
          if (newPos !== tocSettings.position) {
            saveTocPosition(newPos);
          }
        }
      }

      // Rebuild entries array from reordered items
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

      const orderChanged = newPageOrder.some((v, i) => v !== i);
      if (orderChanged) {
        await handleReorder(newPageOrder);
      }

      // Save the explicit page ordering so viewers use the new path.
      await savePageOrder(reordered);
    } finally {
      setIsReordering(false);
    }
  };

  /* ——— Add/remove pricing ————————————————————————————————————— */

  const handleAddPricing = async () => {
    await addPricingPage();
    setSelectedId('pricing');
    setPageOrderVersion((v) => v + 1);
  };

  const handleRemovePricing = async () => {
    const removed = await removePricingPage();
    if (removed) { setSelectedId('pdf-0'); setPageOrderVersion((v) => v + 1); }
  };

  /* ——— Add/remove packages ————————————————————————————————————— */

  const handleAddPackages = async () => {
    const newPage = await addPackagesPage();
    if (newPage) { setSelectedId(`packages-${newPage.id}`); setPageOrderVersion((v) => v + 1); }
  };

  const handleRemovePackages = async (pageId: string) => {
    const removed = await removePackagesPage(pageId);
    if (removed) { setSelectedId('pdf-0'); setPageOrderVersion((v) => v + 1); }
  };

  const handleAddTextPage = async () => {
    const newPage = await addTextPage();
    if (newPage) {
      setSelectedId(`text-${newPage.id}`);
      setPageOrderVersion((v) => v + 1);
    }
  };

  const handleRemoveTextPage = async (pageId: string) => {
    const removed = await removeTextPage(pageId);
    if (removed) { setSelectedId('pdf-0'); setPageOrderVersion((v) => v + 1); }
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
    await flushPackagesSaves();
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
            {packagesPages.filter((p) => p.enabled).length > 0
              ? ` + ${packagesPages.filter((p) => p.enabled).length} packages`
              : ''}
            {textPages.filter((tp) => tp.enabled).length > 0
              ? ` + ${textPages.filter((tp) => tp.enabled).length} text`
              : ''}
            {tocSettings.enabled ? ' + contents' : ''}
          </span>
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

      {/* Action buttons */}
      {(pricingLoaded && packagesLoaded && textPagesLoaded && tocLoaded) && (
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
          {tableName !== 'documents' && (
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
                    const pkg = packagesPages.find((p) => p.id === item.packagesId);
                    return (
                      <SortablePackagesRow
                          key={item.id}
                          id={item.id}
                          title={pkg?.title || 'Your Investment'}
                          indent={pkg?.indent ?? 0}
                          isFirst={visualIdx === 0}
                          isSelected={selectedId === item.id}
                          processing={isReordering || processing}
                          onSelect={() => setSelectedId(item.id)}
                          onToggleIndent={() => {
                            if (pkg) updatePackagesPage(pkg.id, { indent: pkg.indent ? 0 : 1 });
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

                  if (item.type === 'toc') {
                    return (
                      <SortableTocRow
                        key={item.id}
                        id={item.id}
                        title={tocSettings.title}
                        isSelected={selectedId === 'toc'}
                        onSelect={() => setSelectedId('toc')}
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
          ) : selectedIsPackages && selectedPackagesPage ? (
            <PackagesPreviewPanel
              proposalId={proposalId}
              packagesId={selectedPackagesPage.id}
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
          ) : selectedIsToc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              <List size={32} className="text-amber-400 mb-3" />
              <p className="text-sm font-medium text-amber-700">Table of Contents</p>
              <p className="text-xs text-amber-500 mt-1 max-w-[240px]">
                Drag to reposition. Configure content and styling in the Contents tab.
              </p>
            </div>
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
              pageUrls={pageUrls}
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