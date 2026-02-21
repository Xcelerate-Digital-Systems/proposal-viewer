// components/admin/templates/TemplatePageManager.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  Trash2, Plus, Loader2,
  ChevronLeft, ChevronRight, DollarSign,
} from 'lucide-react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  supabase, ProposalTemplate, TemplatePage, TemplatePricing,
  PricingLineItem, PricingOptionalItem, PaymentSchedule, DEFAULT_PAYMENT_SCHEDULE,
} from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import SortableTemplateRow from './SortableTemplateRow';
import SortableTemplatePricingRow from './SortableTemplatePricingRow';
import TemplatePricingPreviewPanel from './TemplatePricingPreviewPanel';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const CUSTOM_VALUE = '__custom__';

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

export type TemplatePricingFormState = {
  enabled: boolean;
  title: string;
  introText: string;
  items: PricingLineItem[];
  optionalItems: PricingOptionalItem[];
  paymentSchedule: PaymentSchedule;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  validityDays: number | null;
};

const DEFAULT_PRICING: TemplatePricingFormState = {
  enabled: true,
  title: 'Project Investment',
  introText: DEFAULT_INTRO,
  items: [],
  optionalItems: [],
  paymentSchedule: DEFAULT_PAYMENT_SCHEDULE,
  taxEnabled: true,
  taxRate: 10,
  taxLabel: 'GST (10%)',
  validityDays: 30,
};

/* ─── Unified item type ──────────────────────────────────────────── */

type UnifiedItem = {
  id: string;
  type: 'pdf' | 'pricing';
  pageIndex: number; // index into pages[] for pdf items, -1 for pricing
};

/* ─── Component ──────────────────────────────────────────────────── */

interface TemplatePageManagerProps {
  template: ProposalTemplate;
  onRefresh: () => void;
}

export default function TemplatePageManager({ template, onRefresh }: TemplatePageManagerProps) {
  const confirm = useConfirm();
  const toast = useToast();

  // ─── Page state ──────────────────────────────────────────────────
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [previewWidth, setPreviewWidth] = useState(300);

  // Local edits: label + indent keyed by page id
  const [localEdits, setLocalEdits] = useState<Record<string, { label: string; indent: number }>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | null>>({});

  // ─── Pricing state ───────────────────────────────────────────────
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingExists, setPricingExists] = useState(false);
  const [pricingPosition, setPricingPosition] = useState(-1);
  const [pricingForm, setPricingForm] = useState<TemplatePricingFormState>(DEFAULT_PRICING);
  const [pricingSaveStatus, setPricingSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ─── Refs ────────────────────────────────────────────────────────
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const localEditsRef = useRef(localEdits);
  localEditsRef.current = localEdits;
  const pricingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ─── Fetch pages ─────────────────────────────────────────────────
  const fetchPages = useCallback(async () => {
    const { data } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', template.id)
      .order('page_number', { ascending: true });

    const templatePages = (data || []) as TemplatePage[];
    setPages(templatePages);

    const edits: Record<string, { label: string; indent: number }> = {};
    for (const p of templatePages) {
      edits[p.id] = { label: p.label, indent: p.indent ?? 0 };
    }
    setLocalEdits(edits);

    const urls: Record<string, string> = {};
    for (const page of templatePages) {
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(page.file_path, 3600);
      if (urlData?.signedUrl) urls[page.id] = urlData.signedUrl;
    }
    setPageUrls(urls);
    setLoading(false);
  }, [template.id]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // ─── Fetch pricing ───────────────────────────────────────────────
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/templates/pricing?template_id=${template.id}`);
        if (res.ok) {
          const data: TemplatePricing | null = await res.json();
          if (data) {
            setPricingExists(true);
            setPricingPosition(data.position);
            setPricingForm({
              enabled: data.enabled,
              title: data.title,
              introText: data.intro_text || DEFAULT_INTRO,
              items: data.items || [],
              optionalItems: data.optional_items || [],
              paymentSchedule: data.payment_schedule || DEFAULT_PAYMENT_SCHEDULE,
              taxEnabled: data.tax_enabled,
              taxRate: data.tax_rate,
              taxLabel: data.tax_label,
              validityDays: data.validity_days,
            });
          }
        }
      } catch { /* no pricing yet */ }
      setPricingLoaded(true);
    };
    fetchPricing();
  }, [template.id]);

  // ─── Cleanup timers ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
      Object.values(savedTimers.current).forEach(clearTimeout);
      if (pricingDebounce.current) clearTimeout(pricingDebounce.current);
    };
  }, []);

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

    if (pricingExists && pricingForm.enabled) {
      const insertIdx =
        pricingPosition === -1 || pricingPosition >= items.length
          ? items.length
          : pricingPosition;
      items.splice(insertIdx, 0, { id: 'pricing', type: 'pricing', pageIndex: -1 });
    }

    return items;
  }, [pages, pricingExists, pricingForm.enabled, pricingPosition]);

  const selectedIsPricing = selectedId === 'pricing';

  // ─── Page label autosave ─────────────────────────────────────────
  const savePageEdit = useCallback(async (pageId: string, label: string, indent: number) => {
    setSaveStatus((prev) => ({ ...prev, [pageId]: 'saving' }));
    try {
      await supabase.from('template_pages').update({ label, indent }).eq('id', pageId);
      setSaveStatus((prev) => ({ ...prev, [pageId]: 'saved' }));
      if (savedTimers.current[pageId]) clearTimeout(savedTimers.current[pageId]);
      savedTimers.current[pageId] = setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [pageId]: null }));
      }, 2000);
    } catch {
      toast.error('Failed to save');
      setSaveStatus((prev) => ({ ...prev, [pageId]: null }));
    }
  }, [toast]);

  const flushPendingSaves = useCallback(async () => {
    const promises: Promise<void>[] = [];
    for (const [pageId, timer] of Object.entries(debounceTimers.current)) {
      clearTimeout(timer);
      const edit = localEditsRef.current[pageId];
      if (edit) promises.push(savePageEdit(pageId, edit.label, edit.indent));
    }
    debounceTimers.current = {};
    if (promises.length > 0) await Promise.all(promises);
  }, [savePageEdit]);

  const getEdit = (pageId: string) =>
    localEdits[pageId] ?? { label: '', indent: 0 };

  const updateEdit = (pageId: string, changes: Partial<{ label: string; indent: number }>) => {
    const updated = { ...getEdit(pageId), ...changes };
    setLocalEdits((prev) => ({ ...prev, [pageId]: updated }));

    if (debounceTimers.current[pageId]) clearTimeout(debounceTimers.current[pageId]);
    const delay = changes.indent !== undefined ? 0 : 800;
    debounceTimers.current[pageId] = setTimeout(() => {
      savePageEdit(pageId, updated.label, updated.indent);
      delete debounceTimers.current[pageId];
    }, delay);
  };

  const selectPreset = (pageId: string, label: string) => {
    if (label !== CUSTOM_VALUE) updateEdit(pageId, { label });
    setOpenDropdown(null);
  };

  const toggleIndent = (pageId: string, pageIndex: number) => {
    if (pageIndex === 0) return;
    const current = getEdit(pageId);
    updateEdit(pageId, { indent: current.indent === 0 ? 1 : 0 });
  };

  // ─── Pricing autosave ───────────────────────────────────────────
  const savePricing = useCallback(async (form: TemplatePricingFormState, pos: number) => {
    setPricingSaveStatus('saving');
    try {
      await fetch('/api/templates/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          enabled: form.enabled,
          position: pos,
          title: form.title,
          intro_text: form.introText,
          items: form.items,
          optional_items: form.optionalItems,
          payment_schedule: form.paymentSchedule,
          tax_enabled: form.taxEnabled,
          tax_rate: form.taxRate,
          tax_label: form.taxLabel,
          validity_days: form.validityDays,
        }),
      });
      setPricingSaveStatus('saved');
      setTimeout(() => setPricingSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setPricingSaveStatus('idle');
    }
  }, [template.id, toast]);

  // ─── Add / Remove pricing ───────────────────────────────────────
  const handleAddPricing = async () => {
    const pos = pages.length; // default: at end
    const form = { ...DEFAULT_PRICING, enabled: true };
    setPricingForm(form);
    setPricingExists(true);
    setPricingPosition(pos);
    setSelectedId('pricing');
    await savePricing(form, pos);
    toast.success('Pricing page added');
  };

  const handleRemovePricing = async () => {
    const ok = await confirm({
      title: 'Remove Pricing Page',
      message: 'Remove the pricing page from this template?',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    const updated = { ...pricingForm, enabled: false };
    setPricingForm(updated);
    await savePricing(updated, pricingPosition);
    setSelectedId('pdf-0');
    toast.success('Pricing page removed');
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
    // Find what index the new page will be at
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

    // Extract new PDF page order (maps new position → original index)
    const pdfItems = reordered.filter((i) => i.type === 'pdf');
    const newPageOrder = pdfItems.map((i) => i.pageIndex);

    // Compute new pricing position
    if (pricingExists && pricingForm.enabled) {
      const pricingIdx = reordered.findIndex((i) => i.type === 'pricing');
      const pdfBeforePricing = reordered
        .slice(0, pricingIdx)
        .filter((i) => i.type === 'pdf').length;
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
      // Optimistic local reorder
      const reorderedPages = newPageOrder.map((origIdx) => pages[origIdx]);
      setPages(reorderedPages);

      // Rebuild localEdits to match new order
      const newEdits: Record<string, { label: string; indent: number }> = {};
      for (const p of reorderedPages) {
        newEdits[p.id] = localEdits[p.id] ?? { label: p.label, indent: p.indent ?? 0 };
      }
      setLocalEdits(newEdits);

      // Update selected to follow the moved item
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
        // Re-fetch to get correct page_numbers from DB
        fetchPages();
      } catch {
        toast.error('Failed to reorder pages');
        fetchPages(); // revert
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

  // ─── Selected page data ──────────────────────────────────────────
  const selectedPdfIndex = selectedId.startsWith('pdf-') ? parseInt(selectedId.replace('pdf-', '')) : -1;
  const selectedPageData = selectedPdfIndex >= 0 ? pages[selectedPdfIndex] : null;
  const selectedPageUrl = selectedPageData ? pageUrls[selectedPageData.id] : null;
  const currentVisualIdx = unifiedItems.findIndex((i) => i.id === selectedId);
  const canGoPrev = currentVisualIdx > 0;
  const canGoNext = currentVisualIdx < unifiedItems.length - 1;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Template Pages</h3>
          <span className="text-xs text-gray-400">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
            {pricingExists && pricingForm.enabled ? ' + pricing' : ''}
          </span>
        </div>
        {processing && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin text-[#017C87]" />
            Processing...
          </div>
        )}
      </div>

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
            <div ref={listRef} className="flex-1 space-y-0.5 p-1 overflow-y-auto pr-1">
              {/* Insert-at-start button */}
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
                        onSelectPreset={(label: string) => selectPreset(page.id, label)}
                        onReplacePage={(file: File) => handleReplacePage(page.page_number, file)}
                        onDeletePage={() => deletePage(page.page_number)}
                        onInsertAfter={(file: File) => handleAddPage(page.page_number, file)}
                      />
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
            ) : selectedPageUrl ? (
              <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
                {/* Preview header with nav */}
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

                {/* PDF page */}
                <div className="flex-1 min-h-0 overflow-hidden bg-white flex items-center justify-center">
                  <Document
                    file={selectedPageUrl}
                    loading={<Loader2 size={16} className="animate-spin text-gray-300" />}
                  >
                    <Page
                      pageNumber={1}
                      width={previewWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="max-h-full"
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