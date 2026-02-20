// components/admin/PageEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  Save, ChevronDown, ChevronLeft, ChevronRight, CornerDownRight,
  ArrowLeft, Upload, Loader2, Plus, Trash2,
} from 'lucide-react';
import { supabase, PageNameEntry, normalizePageNames } from '@/lib/supabase';
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
const PANEL_HEIGHT = 520;

interface PageEditorProps {
  proposalId: string;
  filePath: string;
  initialPageNames: (PageNameEntry | string)[];
  onSave: () => void;
  onCancel: () => void;
}

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel }: PageEditorProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [entries, setEntries] = useState<PageNameEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(0);
  const [previewWidth, setPreviewWidth] = useState(300);
  const [processing, setProcessing] = useState(false);
  const [pdfVersion, setPdfVersion] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Measure preview container width for PDF rendering
  useEffect(() => {
    const measure = () => {
      if (previewContainerRef.current) {
        const w = previewContainerRef.current.offsetWidth - 2;
        setPreviewWidth(Math.max(200, w));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const loadPdfUrl = async () => {
    const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
    if (data?.signedUrl) setPdfUrl(data.signedUrl + '&v=' + Date.now());
  };

  useEffect(() => {
    loadPdfUrl();
  }, [filePath, pdfVersion]);

  useEffect(() => {
    const normalized = normalizePageNames(initialPageNames, initialPageNames.length || 0);
    setEntries(normalized);
  }, [initialPageNames]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll the selected row into view
  useEffect(() => {
    if (listRef.current) {
      const row = listRef.current.querySelector(`[data-page-index="${selectedPage}"]`) as HTMLElement | undefined;
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedPage]);

  const onDocLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPageCount(numPages);
    setEntries((prev) => {
      const updated = [...prev];
      while (updated.length < numPages) {
        updated.push({ name: `Page ${updated.length + 1}`, indent: 0 });
      }
      return updated.slice(0, numPages);
    });
  };

  const updateEntry = (index: number, changes: Partial<PageNameEntry>) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...changes };
      return updated;
    });
  };

  const selectPreset = (index: number, label: string) => {
    if (label === CUSTOM_VALUE) {
      updateEntry(index, { name: entries[index].name });
    } else {
      updateEntry(index, { name: label });
    }
    setOpenDropdown(null);
  };

  const toggleIndent = (index: number) => {
    if (index === 0) return;
    const currentIndent = entries[index].indent;
    updateEntry(index, { indent: currentIndent === 0 ? 1 : 0 });
  };

  const isPreset = (name: string) => PRESET_LABELS.includes(name.toUpperCase());

  /* ------------------------------------------------------------------ */
  /*  Save labels to DB                                                  */
  /* ------------------------------------------------------------------ */
  const handleSave = async () => {
    await supabase.from('proposals').update({ page_names: entries }).eq('id', proposalId);
    onSave();
  };

  /* ------------------------------------------------------------------ */
  /*  Replace a single page's PDF                                        */
  /* ------------------------------------------------------------------ */
  const handleReplacePage = async (pageNumber: number, file: File) => {
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('proposal_id', proposalId);
      formData.append('page_number', pageNumber.toString());
      formData.append('file', file);

      const res = await fetch('/api/proposals/replace-page', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to replace page');
        setProcessing(false);
        return;
      }

      toast.success(`Page ${pageNumber} replaced`);
      setPdfVersion((v) => v + 1);
    } catch {
      toast.error('Failed to replace page');
    }
    setProcessing(false);
  };

  /* ------------------------------------------------------------------ */
  /*  Insert a page after a given position                               */
  /* ------------------------------------------------------------------ */
  const handleInsertPage = async (afterPage: number, file: File) => {
    // Save current labels first so nothing is lost
    await supabase.from('proposals').update({ page_names: entries }).eq('id', proposalId);

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('proposal_id', proposalId);
      formData.append('after_page', afterPage.toString());
      formData.append('file', file);

      const res = await fetch('/api/proposals/insert-page', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to insert page');
        setProcessing(false);
        return;
      }

      const result = await res.json();

      // Update entries locally to match what the server wrote
      setEntries((prev) => {
        const updated = [...prev];
        const newEntries = Array.from(
          { length: result.pages_inserted || 1 },
          (_, idx) => ({ name: `Page ${afterPage + idx + 1}`, indent: 0 })
        );
        updated.splice(afterPage, 0, ...newEntries);
        return updated;
      });

      setPageCount(result.total_pages);
      setSelectedPage(afterPage); // Select the first inserted page
      toast.success(`Page inserted after page ${afterPage || 'start'}`);
      setPdfVersion((v) => v + 1);
    } catch {
      toast.error('Failed to insert page');
    }
    setProcessing(false);
  };

  /* ------------------------------------------------------------------ */
  /*  Delete a page                                                      */
  /* ------------------------------------------------------------------ */
  const handleDeletePage = async (pageNumber: number) => {
    if (pageCount <= 1) {
      toast.error('Cannot delete the only remaining page');
      return;
    }

    const ok = await confirm({
      title: 'Delete page?',
      message: `This will permanently remove page ${pageNumber} from the proposal PDF. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    // Save current labels first so nothing is lost
    await supabase.from('proposals').update({ page_names: entries }).eq('id', proposalId);

    setProcessing(true);
    try {
      const res = await fetch('/api/proposals/delete-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, page_number: pageNumber }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete page');
        setProcessing(false);
        return;
      }

      const result = await res.json();

      // Update entries locally
      setEntries((prev) => {
        const updated = [...prev];
        updated.splice(pageNumber - 1, 1);
        return updated;
      });

      setPageCount(result.total_pages);

      // Adjust selection
      if (selectedPage >= result.total_pages) {
        setSelectedPage(Math.max(0, result.total_pages - 1));
      }

      toast.success(`Page ${pageNumber} deleted`);
      setPdfVersion((v) => v + 1);
    } catch {
      toast.error('Failed to delete page');
    }
    setProcessing(false);
  };

  const goPrev = () => setSelectedPage((p) => Math.max(0, p - 1));
  const goNext = () => setSelectedPage((p) => Math.min(pageCount - 1, p + 1));

  /* ------------------------------------------------------------------ */
  /*  Render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="border-t border-gray-200 bg-gray-50 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-900">Edit Page Labels</h4>
          {processing && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin text-[#017C87]" />
              Processing...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Choose a label from the dropdown or select &quot;Custom&quot; to type your own. Use the indent button to nest pages under a parent.
      </p>

      {/* 50/50 split — fixed height so both sides fill equally */}
      <div className="flex gap-5" style={{ height: PANEL_HEIGHT }}>
        {/* Left half: page label controls */}
        <div className="w-1/2 min-w-0 overflow-hidden flex flex-col" ref={dropdownRef}>
          <div ref={listRef} className="flex-1 overflow-y-auto pr-1">
            {/* Insert-at-start button */}
            <div className="flex justify-center py-0.5">
              <label
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                  processing
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-400 hover:text-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
                }`}
                title="Insert page at start"
              >
                <Plus size={10} />
                Insert
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  disabled={processing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleInsertPage(0, f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {entries.map((entry, i) => {
              const isCustom = !isPreset(entry.name);
              const isDropdownOpen = openDropdown === i;
              const isSelected = selectedPage === i;

              return (
                <div key={`page-${i}-${pageCount}`}>
                  {/* Page row */}
                  <div
                    data-page-index={i}
                    className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#017C87]/10 ring-1 ring-[#017C87]/30'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedPage(i)}
                  >
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>

                    <button
                      onClick={(e) => { e.stopPropagation(); toggleIndent(i); }}
                      disabled={i === 0}
                      title={entry.indent ? 'Remove indent' : 'Indent under parent'}
                      className={`shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors ${
                        i === 0
                          ? 'text-gray-200 cursor-not-allowed'
                          : entry.indent
                          ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {entry.indent ? <ArrowLeft size={12} /> : <CornerDownRight size={12} />}
                    </button>

                    {entry.indent > 0 && (
                      <span className="text-[10px] text-[#017C87]/50 shrink-0">SUB</span>
                    )}

                    <div className="flex-1 relative min-w-0" onClick={(e) => e.stopPropagation()}>
                      {isCustom ? (
                        <div className="flex items-center gap-0">
                          <input
                            type="text"
                            value={entry.name}
                            onChange={(e) => updateEntry(i, { name: e.target.value })}
                            onFocus={() => setSelectedPage(i)}
                            className="flex-1 min-w-0 px-2 py-1 rounded-l-md border border-r-0 border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:border-[#017C87]/40 placeholder:text-gray-400"
                            placeholder="Custom label..."
                          />
                          <button
                            onClick={() => setOpenDropdown(isDropdownOpen ? null : i)}
                            className="px-1.5 py-1 rounded-r-md border border-gray-200 bg-white text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <ChevronDown size={12} className={isDropdownOpen ? 'rotate-180' : ''} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setOpenDropdown(isDropdownOpen ? null : i)}
                          className="w-full flex items-center justify-between px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-900 text-xs hover:border-gray-300 transition-colors"
                        >
                          <span className="truncate">{entry.name}</span>
                          <ChevronDown size={12} className={`text-gray-400 shrink-0 ml-1 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      {isDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {PRESET_LABELS.map((label) => (
                            <button
                              key={label}
                              onClick={() => selectPreset(i, label)}
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
                            onClick={() => selectPreset(i, CUSTOM_VALUE)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors italic"
                          >
                            Custom...
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Replace page button */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <label
                        className={`p-1 rounded flex items-center justify-center transition-colors ${
                          processing
                            ? 'text-gray-200 cursor-not-allowed'
                            : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-pointer'
                        }`}
                        title="Replace page PDF"
                      >
                        <Upload size={11} />
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          disabled={processing}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleReplacePage(i + 1, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {/* Delete page button */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeletePage(i + 1)}
                        disabled={processing || pageCount <= 1}
                        className={`p-1 rounded flex items-center justify-center transition-colors ${
                          processing || pageCount <= 1
                            ? 'text-gray-200 cursor-not-allowed'
                            : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title="Delete page"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Insert-after button */}
                  <div className="flex justify-center py-0.5">
                    <label
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                        processing
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-400 hover:text-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
                      }`}
                      title={`Insert page after page ${i + 1}`}
                    >
                      <Plus size={10} />
                      Insert
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        disabled={processing}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleInsertPage(i + 1, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {entries.length === 0 && (
              <p className="text-sm text-gray-400">Loading pages...</p>
            )}
          </div>
        </div>

        {/* Right half: full-height PDF preview */}
        <div className="w-1/2 min-w-0 flex flex-col" ref={previewContainerRef}>
          {pdfUrl ? (
            <Document file={pdfUrl} onLoadSuccess={onDocLoadSuccess} loading={null} key={pdfVersion}>
              {/* Hidden page for initial load trigger */}
              {pageCount === 0 && (
                <div className="hidden"><Page pageNumber={1} width={1} /></div>
              )}

              {pageCount > 0 && (
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
                        Page {selectedPage + 1} of {pageCount}
                      </span>
                      <button
                        onClick={goNext}
                        disabled={selectedPage >= pageCount - 1}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <span className="text-xs text-[#017C87] font-medium truncate ml-2">
                      {entries[selectedPage]?.name || ''}
                    </span>
                  </div>

                  {/* PDF page — fills remaining height, scales to fit */}
                  <div className="flex-1 min-h-0 overflow-hidden bg-white flex items-center justify-center">
                    <Page
                      pageNumber={selectedPage + 1}
                      width={previewWidth}
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