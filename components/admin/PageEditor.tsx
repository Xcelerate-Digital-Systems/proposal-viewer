// components/admin/PageEditor.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, CornerDownRight,
  ArrowLeft, Upload, Loader2, Plus, Trash2, GripVertical, DollarSign,
} from 'lucide-react';
import {
  supabase, PageNameEntry, PricingLineItem, PricingOptionalItem,
  ProposalPricing, normalizePageNames, pricingSubtotal, pricingTax,
  formatAUD, generateItemId,
} from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import PricingSettings from './pricing/PricingSettings';
import PricingLineItems from './pricing/PricingLineItems';
import PricingOptionalItems from './pricing/PricingOptionalItems';
import PricingTotals from './pricing/PricingTotals';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PRESET_LABELS = [
  'INTRODUCTION', 'TABLE OF CONTENTS', 'EXECUTIVE SUMMARY', 'WHO ARE WE',
  'ABOUT US', 'OUR APPROACH', 'YOUR SOLUTION', 'SERVICES', 'SCOPE OF WORK',
  'HOW WE GET RESULTS', 'METHODOLOGY', 'DELIVERABLES', 'CASE STUDIES',
  'CASE STUDY', 'TESTIMONIALS', 'YOUR INVESTMENT', 'PRICING', 'TIMELINE',
  'FAQ', 'TERMS & CONDITIONS', 'NEXT STEPS', 'CONTACT', 'APPENDIX',
];
const CUSTOM_VALUE = '__custom__';

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

/* ─── Types ─────────────────────────────────────────────────────────── */

type UnifiedItem = {
  id: string;
  type: 'pdf' | 'pricing';
  pdfIndex: number;
};

type PricingFormState = {
  enabled: boolean;
  title: string;
  introText: string;
  items: PricingLineItem[];
  optionalItems: PricingOptionalItem[];
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  validityDays: number | null;
  proposalDate: string;
};

const DEFAULT_PRICING: PricingFormState = {
  enabled: true,
  title: 'Project Investment',
  introText: DEFAULT_INTRO,
  items: [],
  optionalItems: [],
  taxEnabled: true,
  taxRate: 10,
  taxLabel: 'GST (10%)',
  validityDays: 30,
  proposalDate: new Date().toISOString().split('T')[0],
};

interface PageEditorProps {
  proposalId: string;
  filePath: string;
  initialPageNames: (PageNameEntry | string)[];
  onSave: () => void;
  onCancel: () => void;
}

/* ─── Sortable PDF Row ─────────────────────────────────────────────── */

function SortablePdfRow({
  id, entry, visualNum, isSelected, isCustom,
  isDropdownOpen, status, processing, pageCount,
  onSelect, onToggleIndent, onUpdateEntry, onOpenDropdown, onSelectPreset,
  onReplacePage, onDeletePage, index,
}: {
  id: string; entry: PageNameEntry; visualNum: number; isSelected: boolean;
  isCustom: boolean; isDropdownOpen: boolean;
  status: 'saving' | 'saved' | null; processing: boolean; pageCount: number;
  onSelect: () => void; onToggleIndent: () => void;
  onUpdateEntry: (changes: Partial<PageNameEntry>) => void;
  onOpenDropdown: (open: boolean) => void; onSelectPreset: (label: string) => void;
  onReplacePage: (file: File) => void; onDeletePage: () => void;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
          isSelected ? 'bg-[#017C87]/10 ring-1 ring-[#017C87]/30' : 'hover:bg-gray-100'
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>

        <span className="text-xs text-gray-400 w-5 text-right shrink-0 font-medium">{visualNum}.</span>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleIndent(); }}
          disabled={index === 0}
          title={entry.indent ? 'Remove indent' : 'Indent under parent'}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors ${
            index === 0
              ? 'text-gray-200 cursor-not-allowed'
              : entry.indent
              ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          {entry.indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
        </button>

        {entry.indent > 0 && <span className="text-[10px] text-[#017C87]/50 shrink-0">SUB</span>}

        <div className="flex-1 relative min-w-0" onClick={(e) => e.stopPropagation()}>
          {isCustom ? (
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={entry.name}
                onChange={(e) => onUpdateEntry({ name: e.target.value })}
                onFocus={onSelect}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-l-md border border-r-0 border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-[#017C87]/40 placeholder:text-gray-400"
                placeholder="Custom label..."
              />
              <button
                onClick={() => onOpenDropdown(!isDropdownOpen)}
                className="px-2 py-1.5 rounded-r-md border border-gray-200 bg-white text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronDown size={13} className={isDropdownOpen ? 'rotate-180' : ''} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenDropdown(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-900 text-sm hover:border-gray-300 transition-colors"
            >
              <span className="truncate">{entry.name}</span>
              <ChevronDown size={13} className={`text-gray-400 shrink-0 ml-1 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {isDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {PRESET_LABELS.map((label) => (
                <button
                  key={label}
                  onClick={() => onSelectPreset(label)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-100 last:border-0 ${
                    entry.name === label
                      ? 'text-[#017C87] bg-[#017C87]/5'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => onSelectPreset(CUSTOM_VALUE)}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors italic"
              >
                Custom...
              </button>
            </div>
          )}
        </div>

        {/* Autosave status */}
        <div className="shrink-0 w-5 flex items-center justify-center">
          {status === 'saving' && <Loader2 size={12} className="animate-spin text-gray-300" />}
          {status === 'saved' && <Check size={13} className="text-emerald-400" />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <label
            className={`p-1.5 rounded-md flex items-center justify-center border transition-colors ${
              processing
                ? 'text-gray-200 border-gray-100 cursor-not-allowed'
                : 'text-[#017C87] border-[#017C87]/25 hover:bg-[#017C87]/5 hover:border-[#017C87]/40 cursor-pointer'
            }`}
            title="Replace page PDF"
          >
            <Upload size={13} />
            <input type="file" accept=".pdf" className="hidden" disabled={processing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplacePage(f); e.target.value = ''; }}
            />
          </label>
          <button
            onClick={onDeletePage}
            disabled={processing || pageCount <= 1}
            className={`p-1.5 rounded-md flex items-center justify-center border transition-colors ${
              processing || pageCount <= 1
                ? 'text-gray-200 border-gray-100 cursor-not-allowed'
                : 'text-[#017C87] border-[#017C87]/25 hover:text-red-500 hover:bg-red-50 hover:border-red-200'
            }`}
            title="Delete page"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sortable Pricing Row ─────────────────────────────────────────── */

function SortablePricingRow({
  id, title, isSelected, onSelect,
}: {
  id: string; title: string; isSelected: boolean; onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors border border-dashed ${
          isSelected
            ? 'bg-[#017C87]/10 border-[#017C87]/40 ring-1 ring-[#017C87]/30'
            : 'border-[#017C87]/20 hover:bg-[#017C87]/5'
        }`}
        onClick={onSelect}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-[#017C87]/40 hover:text-[#017C87] cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-[#017C87]/10">
          <DollarSign size={13} className="text-[#017C87]" />
        </div>
        <span className="text-sm font-medium text-[#017C87] flex-1 truncate">{title || 'Pricing Page'}</span>
      </div>
    </div>
  );
}

/* ─── Main PageEditor ──────────────────────────────────────────────── */

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel }: PageEditorProps) {
  const confirm = useConfirm();
  const toast = useToast();

  // PDF state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [entries, setEntries] = useState<PageNameEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [pdfVersion, setPdfVersion] = useState(0);

  // UI state
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string>('pdf-0');
  const [previewWidth, setPreviewWidth] = useState(300);
  const [processing, setProcessing] = useState(false);
  const [panelHeight, setPanelHeight] = useState(520);

  // Pricing state
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingExists, setPricingExists] = useState(false);
  const [pricingPosition, setPricingPosition] = useState(-1);
  const [pricingForm, setPricingForm] = useState<PricingFormState>(DEFAULT_PRICING);

  // Label autosave state
  const [saveStatus, setSaveStatus] = useState<Record<number, 'saving' | 'saved' | null>>({});
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const dirtyRowsRef = useRef(dirtyRows);
  dirtyRowsRef.current = dirtyRows;

  // Pricing autosave
  const pricingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pricingSaveStatus, setPricingSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // DnD sensors — require minimum 8px drag distance to avoid interfering with clicks
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
  const selectedPdfIndex = selectedIsPricing ? -1 : parseInt(selectedId.replace('pdf-', ''));

  /* ─── Measure layout ─────────────────────────────────────────────── */

  useEffect(() => {
    const measure = () => {
      if (previewContainerRef.current) {
        setPreviewWidth(Math.max(200, previewContainerRef.current.offsetWidth - 2));
      }
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

  /* ─── Load PDF ───────────────────────────────────────────────────── */

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setPdfUrl(data.signedUrl + '&v=' + Date.now());
    };
    load();
  }, [filePath, pdfVersion]);

  useEffect(() => {
    setEntries(normalizePageNames(initialPageNames, initialPageNames.length || 0));
  }, [initialPageNames]);

  /* ─── Load pricing ───────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/proposals/pricing?proposal_id=${proposalId}`);
        if (res.ok) {
          const data: ProposalPricing | null = await res.json();
          if (data) {
            setPricingExists(true);
            setPricingPosition(data.position);
            setPricingForm({
              enabled: data.enabled,
              title: data.title,
              introText: data.intro_text || DEFAULT_INTRO,
              items: data.items || [],
              optionalItems: data.optional_items || [],
              taxEnabled: data.tax_enabled,
              taxRate: data.tax_rate,
              taxLabel: data.tax_label,
              validityDays: data.validity_days,
              proposalDate: data.proposal_date || new Date().toISOString().split('T')[0],
            });
          }
        }
      } catch { /* no pricing yet */ }
      setPricingLoaded(true);
    };
    fetchPricing();
  }, [proposalId]);

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

  /* ─── Cleanup timers ─────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (pricingDebounce.current) clearTimeout(pricingDebounce.current);
      Object.values(savedTimers.current).forEach(clearTimeout);
    };
  }, []);

  /* ─── PDF load ───────────────────────────────────────────────────── */

  const onDocLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPageCount(numPages);
    setEntries((prev) => {
      const updated = [...prev];
      while (updated.length < numPages) updated.push({ name: `Page ${updated.length + 1}`, indent: 0 });
      return updated.slice(0, numPages);
    });
  };

  /* ─── Label autosave ─────────────────────────────────────────────── */

  const saveEntries = useCallback(async (entriesToSave: PageNameEntry[], rowsToMark: Set<number>) => {
    const savingStatus: Record<number, 'saving'> = {};
    rowsToMark.forEach((idx) => { savingStatus[idx] = 'saving'; });
    setSaveStatus((prev) => ({ ...prev, ...savingStatus }));

    try {
      await supabase.from('proposals').update({ page_names: entriesToSave }).eq('id', proposalId);
      const savedStatus: Record<number, 'saved'> = {};
      rowsToMark.forEach((idx) => { savedStatus[idx] = 'saved'; });
      setSaveStatus((prev) => ({ ...prev, ...savedStatus }));
      rowsToMark.forEach((idx) => {
        if (savedTimers.current[idx]) clearTimeout(savedTimers.current[idx]);
        savedTimers.current[idx] = setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [idx]: null }));
        }, 2000);
      });
    } catch {
      toast.error('Failed to save');
      const clearedStatus: Record<number, null> = {};
      rowsToMark.forEach((idx) => { clearedStatus[idx] = null; });
      setSaveStatus((prev) => ({ ...prev, ...clearedStatus }));
    }
  }, [proposalId, toast]);

  const scheduleSave = useCallback((delay: number, changedIndex: number) => {
    setDirtyRows((prev) => { const next = new Set(prev); next.add(changedIndex); return next; });
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const currentEntries = entriesRef.current;
      const currentDirty = new Set(dirtyRowsRef.current);
      setDirtyRows(new Set());
      saveEntries(currentEntries, currentDirty);
      debounceTimer.current = null;
    }, delay);
  }, [saveEntries]);

  const flushPendingSaves = useCallback(async () => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
    const currentDirty = new Set(dirtyRowsRef.current);
    if (currentDirty.size > 0) { setDirtyRows(new Set()); await saveEntries(entriesRef.current, currentDirty); }
  }, [saveEntries]);

  const updateEntry = (index: number, changes: Partial<PageNameEntry>) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...changes };
      return updated;
    });
    scheduleSave(changes.indent !== undefined ? 0 : 800, index);
  };

  const selectPreset = (index: number, label: string) => {
    if (label !== CUSTOM_VALUE) updateEntry(index, { name: label });
    setOpenDropdown(null);
  };

  const toggleIndent = (index: number) => {
    if (index === 0) return;
    updateEntry(index, { indent: entries[index].indent === 0 ? 1 : 0 });
  };

  const isPreset = (name: string) => PRESET_LABELS.includes(name.toUpperCase());

  /* ─── Pricing autosave ───────────────────────────────────────────── */

  const savePricing = useCallback(async (form: PricingFormState, pos: number) => {
    setPricingSaveStatus('saving');
    try {
      await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: form.enabled,
          position: pos,
          title: form.title,
          intro_text: form.introText,
          items: form.items,
          optional_items: form.optionalItems,
          tax_enabled: form.taxEnabled,
          tax_rate: form.taxRate,
          tax_label: form.taxLabel,
          validity_days: form.validityDays,
          proposal_date: form.proposalDate,
        }),
      });
      setPricingSaveStatus('saved');
      setTimeout(() => setPricingSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setPricingSaveStatus('idle');
    }
  }, [proposalId, toast]);

  const schedulePricingSave = useCallback((form: PricingFormState, pos: number) => {
    if (pricingDebounce.current) clearTimeout(pricingDebounce.current);
    pricingDebounce.current = setTimeout(() => {
      savePricing(form, pos);
      pricingDebounce.current = null;
    }, 800);
  }, [savePricing]);

  const updatePricing = useCallback((changes: Partial<PricingFormState>) => {
    setPricingForm((prev) => {
      const next = { ...prev, ...changes };
      schedulePricingSave(next, pricingPosition);
      return next;
    });
  }, [schedulePricingSave, pricingPosition]);

  const flushPricingSave = useCallback(async () => {
    if (pricingDebounce.current) {
      clearTimeout(pricingDebounce.current);
      pricingDebounce.current = null;
      await savePricing(pricingForm, pricingPosition);
    }
  }, [savePricing, pricingForm, pricingPosition]);

  /* ─── Add pricing page ───────────────────────────────────────────── */

  const addPricingPage = async () => {
    setPricingExists(true);
    setPricingForm(DEFAULT_PRICING);
    setPricingPosition(-1);
    setSelectedId('pricing');
    await savePricing(DEFAULT_PRICING, -1);
    toast.success('Pricing page added');
  };

  /* ─── Remove pricing page ────────────────────────────────────────── */

  const removePricingPage = async () => {
    const ok = await confirm({
      title: 'Remove pricing page?',
      message: 'This will disable the pricing page. Your pricing data will be preserved and can be re-enabled later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    const updated = { ...pricingForm, enabled: false };
    setPricingForm(updated);
    setSelectedId('pdf-0');
    await savePricing(updated, pricingPosition);
    toast.success('Pricing page removed');
  };

  /* ─── PDF operations ─────────────────────────────────────────────── */

  const handleReplacePage = async (pageIndex: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('proposal_id', proposalId);
      formData.append('page_number', (pageIndex + 1).toString());
      formData.append('file', file);
      const res = await fetch('/api/proposals/replace-page', { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to replace page'); }
      else { toast.success(`Page ${pageIndex + 1} replaced`); setPdfVersion((v) => v + 1); }
    } catch { toast.error('Failed to replace page'); }
    setProcessing(false);
  };

  const handleInsertPage = async (afterPage: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('proposal_id', proposalId);
      formData.append('after_page', afterPage.toString());
      formData.append('file', file);
      const res = await fetch('/api/proposals/insert-page', { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to insert page'); setProcessing(false); return; }
      const result = await res.json();
      setEntries((prev) => {
        const updated = [...prev];
        const newEntries = Array.from({ length: result.pages_inserted || 1 }, (_, idx) => ({ name: `Page ${afterPage + idx + 1}`, indent: 0 }));
        updated.splice(afterPage, 0, ...newEntries);
        return updated;
      });
      setPageCount(result.total_pages);
      setSelectedId(`pdf-${afterPage}`);
      toast.success('Page inserted');
      setPdfVersion((v) => v + 1);
    } catch { toast.error('Failed to insert page'); }
    setProcessing(false);
  };

  const handleDeletePage = async (pageIndex: number) => {
    if (pageCount <= 1) { toast.error('Cannot delete the only remaining page'); return; }
    const ok = await confirm({
      title: 'Delete page?',
      message: `This will permanently remove page ${pageIndex + 1} from the proposal PDF. This cannot be undone.`,
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    await flushPendingSaves();
    setProcessing(true);
    try {
      const res = await fetch('/api/proposals/delete-page', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, page_number: pageIndex + 1 }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to delete page'); setProcessing(false); return; }
      const result = await res.json();
      setEntries((prev) => { const updated = [...prev]; updated.splice(pageIndex, 1); return updated; });
      setPageCount(result.total_pages);
      if (selectedPdfIndex >= result.total_pages) setSelectedId(`pdf-${Math.max(0, result.total_pages - 1)}`);
      toast.success(`Page ${pageIndex + 1} deleted`);
      setPdfVersion((v) => v + 1);
    } catch { toast.error('Failed to delete page'); }
    setProcessing(false);
  };

  /* ─── Drag and drop reorder ──────────────────────────────────────── */

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = unifiedItems.findIndex((i) => i.id === active.id);
    const newIdx = unifiedItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(unifiedItems, oldIdx, newIdx);

    // Extract new PDF page order (original indices in new sequence)
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
      // Update entries locally first for instant feedback
      const newEntries = newPageOrder.map((origIdx) => entries[origIdx]);
      setEntries(newEntries);

      // Remap save statuses
      const newSaveStatus: Record<number, 'saving' | 'saved' | null> = {};
      newPageOrder.forEach((origIdx, newIdx) => {
        if (saveStatus[origIdx]) newSaveStatus[newIdx] = saveStatus[origIdx];
      });
      setSaveStatus(newSaveStatus);

      // Call reorder API
      setProcessing(true);
      try {
        const res = await fetch('/api/proposals/reorder-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal_id: proposalId, page_order: newPageOrder }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to reorder pages');
          // Revert on failure
          setEntries(normalizePageNames(initialPageNames, initialPageNames.length || 0));
        } else {
          setPdfVersion((v) => v + 1);
        }
      } catch {
        toast.error('Failed to reorder pages');
      }
      setProcessing(false);
    }
  };

  /* ─── Done ───────────────────────────────────────────────────────── */

  const handleDone = async () => {
    await flushPendingSaves();
    await flushPricingSave();
    onSave();
  };

  const goPrev = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx > 0) setSelectedId(unifiedItems[idx - 1].id);
  };
  const goNext = () => {
    const idx = unifiedItems.findIndex((i) => i.id === selectedId);
    if (idx < unifiedItems.length - 1) setSelectedId(unifiedItems[idx + 1].id);
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
          <div ref={listRef} className="flex-1 overflow-y-auto pr-1 space-y-0.5">
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
                        isCustom={!isPreset(entry.name)}
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

            {/* Add pricing page button (if none exists or disabled) */}
            {pricingLoaded && (!pricingExists || !pricingForm.enabled) && (
              <div className="flex justify-center pt-3 pb-2">
                <button
                  onClick={addPricingPage}
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

        {/* Right half: PDF preview or Pricing editor */}
        <div className="w-1/2 min-w-0 flex flex-col" ref={previewContainerRef}>
          {selectedIsPricing && pricingExists ? (
            /* ─── Pricing editor panel ─────────────────────────── */
            <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-white min-h-0">
              <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                  <DollarSign size={12} className="text-[#017C87]" />
                  Pricing Page
                </span>
                <div className="flex items-center gap-2">
                  {pricingSaveStatus === 'saving' && <Loader2 size={12} className="animate-spin text-gray-300" />}
                  {pricingSaveStatus === 'saved' && <Check size={13} className="text-emerald-400" />}
                  <button
                    onClick={removePricingPage}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={11} />
                    Remove
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
                <PricingSettings
                  title={pricingForm.title}
                  introText={pricingForm.introText}
                  taxEnabled={pricingForm.taxEnabled}
                  validityDays={pricingForm.validityDays}
                  proposalDate={pricingForm.proposalDate}
                  onTitleChange={(v) => updatePricing({ title: v })}
                  onIntroTextChange={(v) => updatePricing({ introText: v })}
                  onTaxEnabledChange={(v) => updatePricing({ taxEnabled: v })}
                  onValidityDaysChange={(v) => updatePricing({ validityDays: v })}
                  onProposalDateChange={(v) => updatePricing({ proposalDate: v })}
                />
                <PricingLineItems
                  items={pricingForm.items}
                  onChange={(items) => updatePricing({ items })}
                />
                <PricingOptionalItems
                  items={pricingForm.optionalItems}
                  onChange={(optionalItems) => updatePricing({ optionalItems })}
                />
                <PricingTotals
                  items={pricingForm.items}
                  taxEnabled={pricingForm.taxEnabled}
                  taxRate={pricingForm.taxRate}
                  taxLabel={pricingForm.taxLabel}
                />
              </div>
            </div>
          ) : pdfUrl ? (
            /* ─── PDF preview ──────────────────────────────────── */
            <Document file={pdfUrl} onLoadSuccess={onDocLoadSuccess} loading={null} key={pdfVersion}>
              {pageCount === 0 && <div className="hidden"><Page pageNumber={1} width={1} /></div>}
              {pageCount > 0 && (
                <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
                  <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={goPrev} disabled={selectedPdfIndex <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs text-gray-500 font-medium">
                        Page {selectedPdfIndex + 1} of {pageCount}
                      </span>
                      <button onClick={goNext} disabled={selectedPdfIndex >= pageCount - 1}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <span className="text-xs text-[#017C87] font-medium truncate ml-2">
                      {entries[selectedPdfIndex]?.name || ''}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden bg-white flex items-center justify-center p-2">
                    <Page
                      pageNumber={selectedPdfIndex + 1}
                      width={previewWidth - 16}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="max-h-full"
                    />
                  </div>
                </div>
              )}
            </Document>
          ) : (
            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
                <p className="text-xs text-gray-400">Loading PDF...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}