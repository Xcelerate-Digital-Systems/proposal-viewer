// components/admin/TemplateDetail.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft, Trash2, Plus, Upload, Loader2,
  ChevronDown, CornerDownRight, Check,
} from 'lucide-react';
import { supabase, ProposalTemplate, TemplatePage } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PRESET_LABELS = [
  'INTRODUCTION',
  'TABLE OF CONTENTS',
  'EXECUTIVE SUMMARY',
  'WHO ARE WE',
  'ABOUT US',
  'OUR APPROACH',
  'YOUR SOLUTION',
  'SERVICES',
  'SCOPE OF WORK',
  'HOW WE GET RESULTS',
  'METHODOLOGY',
  'DELIVERABLES',
  'CASE STUDIES',
  'CASE STUDY',
  'TESTIMONIALS',
  'YOUR INVESTMENT',
  'PRICING',
  'TIMELINE',
  'FAQ',
  'TERMS & CONDITIONS',
  'NEXT STEPS',
  'CONTACT',
  'APPENDIX',
];

const CUSTOM_VALUE = '__custom__';

interface TemplateDetailProps {
  template: ProposalTemplate;
  onBack: () => void;
  onRefresh: () => void;
}

export default function TemplateDetail({ template, onBack, onRefresh }: TemplateDetailProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  // Track local edits: label + indent keyed by page id
  const [localEdits, setLocalEdits] = useState<Record<string, { label: string; indent: number }>>({});
  // Track autosave status per page: 'saving' | 'saved' | null
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | null>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Debounce timers keyed by page id
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // "Saved" indicator clear timers
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Keep a ref to localEdits so flushPendingSaves can read current values
  const localEditsRef = useRef(localEdits);
  localEditsRef.current = localEdits;

  const fetchPages = async () => {
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
  };

  useEffect(() => { fetchPages(); }, [template.id]);

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

  // Autosave a single page's label + indent to DB
  const savePageEdit = useCallback(async (pageId: string, label: string, indent: number) => {
    setSaveStatus((prev) => ({ ...prev, [pageId]: 'saving' }));
    try {
      await supabase.from('template_pages')
        .update({ label, indent })
        .eq('id', pageId);
      setSaveStatus((prev) => ({ ...prev, [pageId]: 'saved' }));
      // Clear "saved" indicator after 2s
      if (savedTimers.current[pageId]) clearTimeout(savedTimers.current[pageId]);
      savedTimers.current[pageId] = setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [pageId]: null }));
      }, 2000);
    } catch {
      toast.error('Failed to save');
      setSaveStatus((prev) => ({ ...prev, [pageId]: null }));
    }
  }, [toast]);

  // Flush any pending debounced saves (call before delete/replace/insert)
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

    // Debounce save — 800ms for typing, instant for indent/preset selection
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
    if (label === CUSTOM_VALUE) {
      // Keep current label, just close dropdown
    } else {
      updateEdit(pageId, { label });
    }
    setOpenDropdown(null);
  };

  const toggleIndent = (pageId: string, pageIndex: number) => {
    if (pageIndex === 0) return;
    const current = getEdit(pageId);
    updateEdit(pageId, { indent: current.indent === 0 ? 1 : 0 });
  };

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

    // Flush any pending saves before page operations
    await flushPendingSaves();

    setProcessing(true);

    await fetch('/api/templates/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: template.id, page_number: pageNumber }),
    });

    setProcessing(false);
    toast.success('Page deleted');
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

    await fetch('/api/templates/pages', { method: 'POST', body: formData });

    setProcessing(false);
    toast.success('Page inserted');
    onRefresh();
    fetchPages();
  };

  return (
    <div ref={dropdownRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            All Templates
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h2 className="text-gray-900 font-semibold text-lg font-[family-name:var(--font-display)]">
            {template.name}
          </h2>
          <span className="text-sm text-gray-400">{pages.length} pages</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Choose a label from the dropdown or type a custom one. Changes save automatically. Use the indent button to nest pages under a parent tab.
      </p>

      {processing && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <Loader2 size={14} className="animate-spin text-[#017C87]" />
          Processing changes...
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page, idx) => {
            const edit = getEdit(page.id);
            const isCustom = !isPreset(edit.label);
            const isDropdownOpen = openDropdown === page.id;
            const status = saveStatus[page.id];

            return (
              <div key={page.id}>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors shadow-sm">
                  <div className="flex items-stretch">
                    {/* PDF Thumbnail */}
                    <div className="w-36 bg-gray-50 border-r border-gray-200 flex items-center justify-center shrink-0 p-2">
                      {pageUrls[page.id] ? (
                        <Document file={pageUrls[page.id]} loading={<Loader2 size={16} className="animate-spin text-gray-300" />}>
                          <Page
                            pageNumber={1}
                            width={125}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </Document>
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Page info */}
                    <div className="flex-1 p-4 flex items-center gap-3 min-w-0">
                      {/* Page number */}
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider shrink-0 w-8 text-right">
                        {page.page_number}.
                      </span>

                      {/* Indent toggle */}
                      <button
                        onClick={() => toggleIndent(page.id, idx)}
                        disabled={idx === 0}
                        title={edit.indent ? 'Remove indent' : 'Indent under parent'}
                        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                          idx === 0
                            ? 'text-gray-200 cursor-not-allowed'
                            : edit.indent
                            ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {edit.indent ? <ArrowLeft size={14} /> : <CornerDownRight size={14} />}
                      </button>

                      {edit.indent > 0 && (
                        <span className="text-[10px] text-[#017C87]/50 shrink-0 font-medium">SUB</span>
                      )}

                      {/* Label: dropdown or custom input */}
                      <div className="flex-1 relative min-w-0">
                        {isCustom ? (
                          <div className="flex items-center gap-0">
                            <input
                              type="text"
                              value={edit.label}
                              onChange={(e) => updateEdit(page.id, { label: e.target.value })}
                              className="flex-1 min-w-0 px-3 py-2 rounded-l-lg border border-r-0 border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-[#017C87]/40 placeholder:text-gray-400"
                              placeholder="Custom label..."
                            />
                            <button
                              onClick={() => setOpenDropdown(isDropdownOpen ? null : page.id)}
                              className="px-2.5 py-2 rounded-r-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <ChevronDown size={14} className={isDropdownOpen ? 'rotate-180' : ''} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setOpenDropdown(isDropdownOpen ? null : page.id)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm hover:border-gray-300 transition-colors"
                          >
                            <span className="truncate">{edit.label}</span>
                            <ChevronDown size={14} className={`text-gray-400 shrink-0 ml-1 ${isDropdownOpen ? 'rotate-180' : ''}`} />
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

                      {/* Autosave status indicator */}
                      <div className="shrink-0 w-5 flex items-center justify-center">
                        {status === 'saving' && (
                          <Loader2 size={12} className="animate-spin text-gray-300" />
                        )}
                        {status === 'saved' && (
                          <Check size={13} className="text-emerald-400" />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 ml-1">
                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer">
                          <Upload size={12} />
                          Replace
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
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add page after button */}
                <div className="flex items-center justify-center py-1">
                  <label className="flex items-center gap-1 px-3 py-1 rounded text-xs text-gray-300 hover:text-[#017C87] hover:bg-[#017C87]/5 transition-colors cursor-pointer">
                    <Plus size={12} />
                    Insert page after
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
      )}
    </div>
  );
}