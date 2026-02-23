// components/admin/templates/TemplatePageManager.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  Plus, Loader2,
  ChevronLeft, ChevronRight, DollarSign, FileText, FolderOpen,
} from 'lucide-react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import SortableTemplateRow from './SortableTemplateRow';
import SortableTemplatePricingRow from './SortableTemplatePricingRow';
import TemplatePricingPreviewPanel from './TemplatePricingPreviewPanel';
import { useTextPagesState } from '@/components/admin/page-editor/useTextPagesState';
import SortableTextRow from '@/components/admin/page-editor/SortableTextRow';
import SortableGroupRow from '@/components/admin/page-editor/SortableGroupRow';
import TextPagePreviewPanel from '@/components/admin/page-editor/TextPagePreviewPanel';
import { useTemplatePageState } from './useTemplatePageState';
import { useTemplatePricingState } from './useTemplatePricingState';
import { useTemplateSectionHeaders } from './useTemplateSectionHeaders';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/* ─── Unified item type ──────────────────────────────────────────── */

type UnifiedItem = {
  id: string;
  type: 'pdf' | 'pricing' | 'text' | 'group';
  pageIndex: number;
  textPageId?: string;
  groupId?: string;
};

/* ─── Component ──────────────────────────────────────────────────── */

interface TemplatePageManagerProps {
  template: ProposalTemplate;
  onRefresh: () => void;
}

export default function TemplatePageManager({ template, onRefresh }: TemplatePageManagerProps) {
  const confirm = useConfirm();
  const toast = useToast();

  // ─── Hooks ───────────────────────────────────────────────────────
  const {
    pages, setPages, pageUrls, loading, localEdits, setLocalEdits,
    saveStatus, fetchPages, flushPendingSaves,
    getEdit, updateEdit, selectPreset, toggleIndent,
  } = useTemplatePageState(template.id);

  const {
    pricingLoaded, pricingExists, pricingPosition, setPricingPosition,
    pricingForm, pricingSaveStatus,
    savePricing, addPricingPage, removePricingPage,
  } = useTemplatePricingState(template.id, pages.length);

  const {
    textPagesLoaded, textPages, textPageSaveStatuses,
    updateTextPage, updateTextPagePosition, flushTextPageSaves,
    addTextPage, removeTextPage,
  } = useTextPagesState({ entityId: template.id, entityType: 'template' });

  const {
    sectionHeaders, setSectionHeaders, sectionsLoaded,
    saveSectionHeaders, addSectionHeader, removeSectionHeader, renameSectionHeader,
  } = useTemplateSectionHeaders(template.id);

  // ─── UI state ────────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [previewWidth, setPreviewWidth] = useState(300);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // ─── DnD sensors ─────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ─── Measure preview container ───────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (previewContainerRef.current) {
        setPreviewWidth(Math.max(200, previewContainerRef.current.offsetWidth - 2));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, [loading]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Computed unified items ──────────────────────────────────────
  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = pages.map((_, i) => ({
      id: `pdf-${i}`,
      type: 'pdf' as const,
      pageIndex: i,
    }));

    for (const header of sectionHeaders) {
      const groupItem: UnifiedItem = {
        id: `group-${header.id}`, type: 'group', pageIndex: -1, groupId: header.id,
      };
      if (header.position === -1 || header.position >= items.length) {
        items.push(groupItem);
      } else {
        let pdfCount = 0;
        let insertAt = items.length;
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= header.position) { insertAt = i; break; }
          if (items[i].type === 'pdf') pdfCount++;
          insertAt = i + 1;
        }
        items.splice(insertAt, 0, groupItem);
      }
    }

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
      items.splice(insertIdx, 0, { id: 'pricing', type: 'pricing', pageIndex: -1 });
    }

    for (const tp of textPages) {
      if (!tp.enabled) continue;
      const textItem: UnifiedItem = {
        id: `text-${tp.id}`, type: 'text', pageIndex: -1, textPageId: tp.id,
      };
      if (tp.position === -1 || tp.position >= items.length) {
        items.push(textItem);
      } else {
        let pdfCount = 0;
        let insertAt = items.length;
        for (let i = 0; i < items.length; i++) {
          if (pdfCount >= tp.position) { insertAt = i; break; }
          if (items[i].type === 'pdf') pdfCount++;
          insertAt = i + 1;
        }
        items.splice(insertAt, 0, textItem);
      }
    }

    return items;
  }, [pages, sectionHeaders, pricingExists, pricingForm.enabled, pricingPosition, textPages]);

  const selectedIsPricing = selectedId === 'pricing';
  const selectedIsGroup = selectedId.startsWith('group-');
  const selectedTextPage = selectedId.startsWith('text-')
    ? textPages.find((tp) => tp.id === selectedId.replace('text-', ''))
    : null;

  // ─── Add/remove handlers ─────────────────────────────────────────
  const handleAddPricing = async () => {
    await addPricingPage();
    setSelectedId('pricing');
  };

  const handleRemovePricing = async () => {
    const removed = await removePricingPage();
    if (removed) setSelectedId('pdf-0');
  };

  const handleAddTextPage = async () => {
    const newPage = await addTextPage();
    if (newPage) setSelectedId(`text-${newPage.id}`);
  };

  const handleRemoveTextPage = async (pageId: string) => {
    const removed = await removeTextPage(pageId);
    if (removed) setSelectedId('pdf-0');
  };

  const handleAddSectionHeader = () => {
    const id = addSectionHeader();
    setSelectedId(`group-${id}`);
  };

  const handleRemoveSectionHeader = async (headerId: string) => {
    const removed = await removeSectionHeader(headerId);
    if (removed) setSelectedId('pdf-0');
  };

  // ─── Page CRUD ───────────────────────────────────────────────────
  const deletePage = async (pageNumber: number) => {
    if (pages.length <= 1) {
      toast.error('Template must have at least one page.');
      return;
    }
    const ok = await confirm({
      title: 'Delete Page',
      message: `Delete page ${pageNumber}? Remaining pages will be renumbered.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    await flushPendingSaves();
    setProcessing(true);
    await fetch('/api/templates/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: template.id, page_number: pageNumber }),
    });
    setProcessing(false);
    toast.success('Page deleted');

    if (parseInt(selectedId.replace('pdf-', '')) >= pages.length - 1) {
      setSelectedId(`pdf-${Math.max(0, pages.length - 2)}`);
    }
    onRefresh();
    fetchPages();
  };

  const handleReplacePage = async (pageNumber: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    const page = pages.find((p) => p.page_number === pageNumber);
    const formData = new FormData();
    formData.append('template_id', template.id);
    formData.append('page_number', pageNumber.toString());
    formData.append('label', page?.label || `Page ${pageNumber}`);
    formData.append('company_id', template.company_id);
    formData.append('file', file);
    formData.append('mode', 'replace');
    await fetch('/api/templates/pages', { method: 'POST', body: formData });
    setProcessing(false);
    toast.success(`Page ${pageNumber} replaced`);
    onRefresh();
    fetchPages();
  };

  const handleAddPage = async (afterPageNumber: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    const newPageNumber = afterPageNumber + 1;
    const formData = new FormData();
    formData.append('template_id', template.id);
    formData.append('page_number', newPageNumber.toString());
    formData.append('label', 'New Page');
    formData.append('company_id', template.company_id);
    formData.append('file', file);
    formData.append('mode', 'insert');
    await fetch('/api/templates/pages', { method: 'POST', body: formData });
    setProcessing(false);
    toast.success('Page inserted');
    setSelectedId(`pdf-${newPageNumber - 1}`);
    onRefresh();
    fetchPages();
  };

  // ─── Drag and drop ───────────────────────────────────────────────
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = unifiedItems.findIndex((i) => i.id === active.id);
    const newIdx = unifiedItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(unifiedItems, oldIdx, newIdx);
    const countPdfBefore = (idx: number) =>
      reordered.slice(0, idx).filter((i) => i.type === 'pdf').length;

    const pdfItems = reordered.filter((i) => i.type === 'pdf');
    const newPageOrder = pdfItems.map((i) => i.pageIndex);

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
      if (newPos !== tp.position) updateTextPagePosition(tp.id, newPos);
    }

    // Update section header positions
    let sectionsChanged = false;
    const updatedHeaders = sectionHeaders.map((header) => {
      const groupIdx = reordered.findIndex((i) => i.id === `group-${header.id}`);
      if (groupIdx === -1) return header;
      const isLast = groupIdx === reordered.length - 1;
      const newPos = isLast ? -1 : countPdfBefore(groupIdx);
      if (newPos !== header.position) {
        sectionsChanged = true;
        return { ...header, position: newPos };
      }
      return header;
    });
    if (sectionsChanged) {
      setSectionHeaders(updatedHeaders);
      saveSectionHeaders(updatedHeaders);
    }

    // Reorder PDF pages if order changed
    const orderChanged = newPageOrder.some((v, i) => v !== i);
    if (orderChanged) {
      const reorderedPages = newPageOrder.map((origIdx) => pages[origIdx]);
      setPages(reorderedPages);

      const newEdits: Record<string, { label: string; indent: number }> = {};
      for (const p of reorderedPages) {
        newEdits[p.id] = localEdits[p.id] ?? { label: p.label, indent: p.indent ?? 0 };
      }
      setLocalEdits(newEdits);

      if (selectedId.startsWith('pdf-')) {
        const oldPdfIdx = parseInt(selectedId.replace('pdf-', ''));
        const newPdfIdx = newPageOrder.indexOf(oldPdfIdx);
        if (newPdfIdx !== -1) setSelectedId(`pdf-${newPdfIdx}`);
      }

      try {
        await flushPendingSaves();
        const res = await fetch('/api/templates/reorder-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: template.id, page_order: newPageOrder }),
        });
        if (!res.ok) throw new Error('Reorder failed');
        fetchPages();
      } catch {
        toast.error('Failed to reorder pages');
        fetchPages();
      }
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────
  const goPrev = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx > 0) setSelectedId(unifiedItems[idx - 1].id);
  };
  const goNext = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx < unifiedItems.length - 1) setSelectedId(unifiedItems[idx + 1].id);
  };

  const selectedPdfIndex = selectedId.startsWith('pdf-') ? parseInt(selectedId.replace('pdf-', '')) : -1;
  const selectedPageData = selectedPdfIndex >= 0 ? pages[selectedPdfIndex] : null;
  const selectedPageUrl = selectedPageData ? pageUrls[selectedPageData.id] : null;
  const currentVisualIdx = unifiedItems.findIndex((i) => i.id === selectedId);
  const canGoPrev = currentVisualIdx > 0;
  const canGoNext = currentVisualIdx < unifiedItems.length - 1;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Template Pages</h3>
          <span className="text-xs text-gray-400">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
            {pricingExists && pricingForm.enabled ? ' + pricing' : ''}
            {textPages.filter((tp) => tp.enabled).length > 0
              ? ` + ${textPages.filter((tp) => tp.enabled).length} text`
              : ''}
          </span>
        </div>
        {processing && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin text-[#017C87]" />
            Processing...
          </div>
        )}
      </div>

      {(pricingLoaded && textPagesLoaded && sectionsLoaded) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {(!pricingExists || !pricingForm.enabled) && (
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
            onClick={handleAddSectionHeader}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 hover:border-[#017C87]/50 transition-colors"
          >
            <FolderOpen size={12} />
            Add Section Header
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">
        Drag to reorder pages. Choose a label from the dropdown or select &quot;Custom&quot; to type your own. Changes save automatically.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-5" style={{ height: 520 }}>
          {/* Left half: sortable page list */}
          <div className="w-1/2 min-w-0 overflow-hidden flex flex-col" ref={dropdownRef}>
            <div className="flex-1 space-y-0.5 p-1 overflow-y-auto pr-1">
              <div className="flex justify-center py-1">
                <label
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] transition-colors ${
                    processing
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-400 hover:text-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
                  }`}
                  title="Insert page at start"
                >
                  <Plus size={10} /> Insert
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={processing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAddPage(0, f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={unifiedItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {unifiedItems.map((item, visualIdx) => {
                    if (item.type === 'pricing') {
                      return (
                        <SortableTemplatePricingRow
                          key={item.id}
                          id={item.id}
                          title={pricingForm.title}
                          isSelected={selectedIsPricing}
                          onSelect={() => setSelectedId('pricing')}
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
                          isSelected={selectedId === item.id}
                          onSelect={() => setSelectedId(item.id)}
                          onRemove={() => tp && handleRemoveTextPage(tp.id)}
                        />
                      );
                    }

                    if (item.type === 'group') {
                      const header = sectionHeaders.find((h) => h.id === item.groupId);
                      if (!header) return null;
                      return (
                        <SortableGroupRow
                          key={item.id}
                          id={item.id}
                          name={header.name}
                          isSelected={selectedId === item.id}
                          onSelect={() => setSelectedId(item.id)}
                          onRename={(name) => renameSectionHeader(header.id, name)}
                          onRemove={() => handleRemoveSectionHeader(header.id)}
                        />
                      );
                    }

                    const page = pages[item.pageIndex];
                    if (!page) return null;
                    const edit = getEdit(page.id);

                    return (
                      <SortableTemplateRow
                        key={item.id}
                        id={item.id}
                        label={edit.label}
                        indent={edit.indent}
                        visualNum={visualIdx + 1}
                        isSelected={selectedId === item.id}
                        isDropdownOpen={openDropdown === page.id}
                        status={saveStatus[page.id] || null}
                        processing={processing}
                        index={item.pageIndex}
                        onSelect={() => setSelectedId(item.id)}
                        onToggleIndent={() => toggleIndent(page.id, item.pageIndex)}
                        onLabelChange={(label: string) => updateEdit(page.id, { label })}
                        onOpenDropdown={(open: boolean) => setOpenDropdown(open ? page.id : null)}
                        onSelectPreset={(label: string) => selectPreset(page.id, label, setOpenDropdown)}
                        onReplacePage={(file: File) => handleReplacePage(page.page_number, file)}
                        onDeletePage={() => deletePage(page.page_number)}
                        onInsertAfter={(file: File) => handleAddPage(page.page_number, file)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>

              {pages.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No pages yet</p>
              )}
            </div>
          </div>

          {/* Right half: preview */}
          <div className="w-1/2 min-w-0 flex flex-col" ref={previewContainerRef}>
            {selectedIsPricing && pricingExists ? (
              <TemplatePricingPreviewPanel
                templateId={template.id}
                companyId={template.company_id}
                onGoPrev={goPrev}
                onGoNext={goNext}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
              />
            ) : selectedTextPage ? (
              <TextPagePreviewPanel
                proposalId={template.id}
                companyId={template.company_id}
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
            ) : selectedPageUrl ? (
              <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
                <div className="shrink-0 px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goPrev}
                      disabled={!canGoPrev}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-gray-500 font-medium">
                      Page {currentVisualIdx + 1} of {unifiedItems.length}
                    </span>
                    <button
                      onClick={goNext}
                      disabled={!canGoNext}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-[#017C87] font-medium truncate ml-2">
                    {selectedPageData ? getEdit(selectedPageData.id).label : ''}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden bg-white flex items-center justify-center">
                  <Document
                    key={selectedPageUrl}
                    file={selectedPageUrl}
                    loading={
                      <div className="flex items-center justify-center py-20">
                        <Loader2 size={20} className="animate-spin text-gray-300" />
                      </div>
                    }
                  >
                    <Page
                      pageNumber={1}
                      width={previewWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="max-h-full"
                      loading={
                        <div className="flex items-center justify-center py-20">
                          <Loader2 size={20} className="animate-spin text-gray-300" />
                        </div>
                      }
                    />
                  </Document>
                </div>
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Loading preview...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}