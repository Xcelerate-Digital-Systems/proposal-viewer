// components/admin/TemplatePageManager.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft, Trash2, Plus, Upload, Loader2,
  ChevronDown, ChevronLeft, ChevronRight, CornerDownRight, Check,
} from 'lucide-react';
import { supabase, ProposalTemplate, TemplatePage } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PRESET_LABELS = [
  'INTRODUCTION', 'TABLE OF CONTENTS', 'EXECUTIVE SUMMARY', 'WHO ARE WE',
  'ABOUT US', 'OUR APPROACH', 'YOUR SOLUTION', 'SERVICES', 'SCOPE OF WORK',
  'HOW WE GET RESULTS', 'METHODOLOGY', 'DELIVERABLES', 'CASE STUDIES',
  'CASE STUDY', 'TESTIMONIALS', 'YOUR INVESTMENT', 'PRICING', 'TIMELINE',
  'FAQ', 'TERMS & CONDITIONS', 'NEXT STEPS', 'CONTACT', 'APPENDIX',
];

const CUSTOM_VALUE = '__custom__';

interface TemplatePageManagerProps {
  template: ProposalTemplate;
  onRefresh: () => void;
}

export default function TemplatePageManager({ template, onRefresh }: TemplatePageManagerProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(0);
  const [previewWidth, setPreviewWidth] = useState(300);

  // Track local edits: label + indent keyed by page id
  const [localEdits, setLocalEdits] = useState<Record<string, { label: string; indent: number }>>({});
  // Track autosave status per page
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | null>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce timers keyed by page id
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const localEditsRef = useRef(localEdits);
  localEditsRef.current = localEdits;

  // Measure preview container width
  useEffect(() => {
    const measure = () => {
      if (previewContainerRef.current) {
        const w = previewContainerRef.current.offsetWidth - 2;
        setPreviewWidth(Math.max(200, w));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, [loading]);

  const fetchPages = useCallback(async () => {
    const { data } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', template.id)
      .order('page_number', { ascending: true });

    const templatePages = (data || []) as TemplatePage[];
    setPages(templatePages);

    // Seed local edits from DB
    const edits: Record<string, { label: string; indent: number }> = {};
    for (const p of templatePages) {
      edits[p.id] = { label: p.label, indent: p.indent ?? 0 };
    }
    setLocalEdits(edits);

    // Get signed URLs for all pages
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
      Object.values(savedTimers.current).forEach(clearTimeout);
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

  // Scroll selected row into view
  useEffect(() => {
    if (listRef.current) {
      const row = listRef.current.children[selectedPage] as HTMLElement | undefined;
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedPage]);

  // ─── Autosave ────────────────────────────────────────────────────

  const savePageEdit = useCallback(async (pageId: string, label: string, indent: number) => {
    setSaveStatus((prev) => ({ ...prev, [pageId]: 'saving' }));
    try {
      await supabase.from('template_pages')
        .update({ label, indent })
        .eq('id', pageId);
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
      if (edit) {
        promises.push(savePageEdit(pageId, edit.label, edit.indent));
      }
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
    const isInstant = changes.indent !== undefined;
    const delay = isInstant ? 0 : 800;
    debounceTimers.current[pageId] = setTimeout(() => {
      savePageEdit(pageId, updated.label, updated.indent);
      delete debounceTimers.current[pageId];
    }, delay);
  };

  const isPreset = (name: string) => PRESET_LABELS.includes(name.toUpperCase());

  const selectPreset = (pageId: string, label: string) => {
    if (label !== CUSTOM_VALUE) {
      updateEdit(pageId, { label });
    }
    setOpenDropdown(null);
  };

  const toggleIndent = (pageId: string, pageIndex: number) => {
    if (pageIndex === 0) return;
    const current = getEdit(pageId);
    updateEdit(pageId, { indent: current.indent === 0 ? 1 : 0 });
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

    if (selectedPage >= pages.length - 1) {
      setSelectedPage(Math.max(0, pages.length - 2));
    }

    onRefresh();
    fetchPages();
  };

  const handleReplacePage = async (pageNumber: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    const page = pages.find(p => p.page_number === pageNumber);
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
    setSelectedPage(newPageNumber - 1);
    onRefresh();
    fetchPages();
  };

  // ─── Navigation ──────────────────────────────────────────────────

  const goPrev = () => setSelectedPage((p) => Math.max(0, p - 1));
  const goNext = () => setSelectedPage((p) => Math.min(pages.length - 1, p + 1));

  const selectedPageData = pages[selectedPage];
  const selectedPageUrl = selectedPageData ? pageUrls[selectedPageData.id] : null;

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Template Pages</h3>
          <span className="text-xs text-gray-400">{pages.length} pages</span>
        </div>
        {processing && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin text-[#017C87]" />
            Processing...
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Choose a label from the dropdown or select &quot;Custom&quot; to type your own. Use the indent button to nest pages under a parent.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
        </div>
      ) : (
        /* 50/50 split — fixed height for embedded card panel */
        <div className="flex gap-5" style={{ height: 520 }}>
          {/* Left half: page label controls */}
          <div className="w-1/2 min-w-0 overflow-hidden flex flex-col" ref={dropdownRef}>
            <div ref={listRef} className="flex-1 space-y-0.5 p-1 overflow-y-auto pr-1">
              {pages.map((page, idx) => {
                const edit = getEdit(page.id);
                const isCustom = !isPreset(edit.label);
                const isDropdownOpen = openDropdown === page.id;
                const isSelected = selectedPage === idx;
                const status = saveStatus[page.id];

                return (
                  <div key={page.id}>
                    <div
                      className={`flex items-center gap-2 rounded-lg px-1.5 py-1 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#017C87]/10 ring-1 ring-[#017C87]/30'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedPage(idx)}
                    >
                      <span className="text-xs text-gray-400 w-6 text-right shrink-0">
                        {page.page_number}.
                      </span>

                      {/* Indent toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleIndent(page.id, idx); }}
                        disabled={idx === 0}
                        title={edit.indent ? 'Remove indent' : 'Indent under parent'}
                        className={`shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors ${
                          idx === 0
                            ? 'text-gray-200 cursor-not-allowed'
                            : edit.indent
                            ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {edit.indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
                      </button>

                      {edit.indent > 0 && (
                        <span className="text-[10px] text-[#017C87]/50 shrink-0">SUB</span>
                      )}

                      {/* Label: dropdown or custom input */}
                      <div className="flex-1 relative min-w-0" onClick={(e) => e.stopPropagation()}>
                        {isCustom ? (
                          <div className="flex items-center gap-0">
                            <input
                              type="text"
                              value={edit.label}
                              onChange={(e) => updateEdit(page.id, { label: e.target.value })}
                              onFocus={() => setSelectedPage(idx)}
                              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-l-md border border-r-0 border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-[#017C87]/40 placeholder:text-gray-400"
                              placeholder="Custom label..."
                            />
                            <button
                              onClick={() => setOpenDropdown(isDropdownOpen ? null : page.id)}
                              className="px-2 py-1.5 rounded-r-md border border-gray-200 bg-white text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <ChevronDown size={13} className={isDropdownOpen ? 'rotate-180' : ''} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setOpenDropdown(isDropdownOpen ? null : page.id)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-900 text-sm hover:border-gray-300 transition-colors"
                          >
                            <span className="truncate">{edit.label}</span>
                            <ChevronDown size={13} className={`text-gray-400 shrink-0 ml-1 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {isDropdownOpen && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {PRESET_LABELS.map((label) => (
                              <button
                                key={label}
                                onClick={() => selectPreset(page.id, label)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-100 last:border-0 ${
                                  edit.label === label
                                    ? 'text-[#017C87] bg-[#017C87]/5'
                                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                            <button
                              onClick={() => selectPreset(page.id, CUSTOM_VALUE)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors italic"
                            >
                              Custom...
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Autosave status */}
                      <div className="shrink-0 w-5 flex items-center justify-center">
                        {status === 'saving' && (
                          <Loader2 size={12} className="animate-spin text-gray-300" />
                        )}
                        {status === 'saved' && (
                          <Check size={13} className="text-emerald-400" />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <label className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer" title="Replace page PDF">
                          <Upload size={12} />
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReplacePage(page.page_number, f);
                            }}
                          />
                        </label>
                        <button
                          onClick={() => deletePage(page.page_number)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete page"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Insert page after */}
                    <div className="flex items-center justify-center py-0.5">
                      <label className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-300 hover:text-[#017C87] hover:bg-[#017C87]/5 transition-colors cursor-pointer">
                        <Plus size={10} />
                        Insert after
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleAddPage(page.page_number, f);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right half: PDF preview */}
          <div className="w-1/2 min-w-0 flex flex-col" ref={previewContainerRef}>
            {selectedPageUrl ? (
              <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
                {/* Preview header with nav */}
                <div className="shrink-0 px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goPrev}
                      disabled={selectedPage === 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-gray-500 font-medium">
                      Page {selectedPage + 1} of {pages.length}
                    </span>
                    <button
                      onClick={goNext}
                      disabled={selectedPage >= pages.length - 1}
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