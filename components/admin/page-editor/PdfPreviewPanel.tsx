// components/admin/page-editor/PdfPreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase, PageNameEntry } from '@/lib/supabase';
import type { PageUrlEntry } from '@/hooks/useProposal';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewPanelProps {
  filePath: string;
  pdfVersion: number;
  selectedPdfIndex: number;
  pageCount: number;
  entries: PageNameEntry[];
  onDocLoadSuccess: (data: { numPages: number }) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  /** Per-page signed URLs (post-migration). When provided, filePath is ignored. */
  pageUrls?: PageUrlEntry[];
}

export default function PdfPreviewPanel({
  filePath,
  pdfVersion,
  selectedPdfIndex,
  pageCount,
  entries,
  onDocLoadSuccess,
  onGoPrev,
  onGoNext,
  pageUrls = [],
}: PdfPreviewPanelProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPerPage = pageUrls.length > 0;

  // ── URL loading ─────────────────────────────────────────────────
  // Per-page mode: the URL for the selected page is already a signed URL
  // from the API — use it directly. Re-run whenever the selected index
  // changes so a different page PDF is loaded.
  //
  // Legacy mode: generate a signed URL from the single merged filePath.
  // Re-run whenever filePath or pdfVersion changes (post-operation bump).
  useEffect(() => {
    if (isPerPage) {
      const entry = pageUrls[selectedPdfIndex];
      setPdfUrl(entry?.url ?? null);
    } else {
      const load = async () => {
        const { data } = await supabase.storage
          .from('proposals')
          .createSignedUrl(filePath, 3600);
        if (data?.signedUrl) setPdfUrl(data.signedUrl + '&v=' + Date.now());
      };
      load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPerPage,
    // Per-page deps
    selectedPdfIndex,
    // Legacy deps
    filePath,
    pdfVersion,
  ]);

  // ── Container width measurement ──────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setPreviewWidth(Math.max(200, containerRef.current.offsetWidth - 2));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, []);

  if (!pdfUrl) {
    return (
      <div
        ref={containerRef}
        className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading PDF...</p>
        </div>
      </div>
    );
  }

  // In per-page mode each document has exactly 1 page, so we always render
  // pageNumber={1}. The document is keyed by its URL so react-pdf re-mounts
  // (and re-renders) when the user navigates to a different PDF page.
  //
  // In legacy mode we key by pdfVersion (bumped after operations) and render
  // pageNumber={selectedPdfIndex + 1} as before.
  const documentKey = isPerPage ? pdfUrl : String(pdfVersion);
  const pageNumber = isPerPage ? 1 : selectedPdfIndex + 1;

  // onDocLoadSuccess is only meaningful in legacy mode (syncs page count from
  // the merged PDF). In per-page mode the page count comes from pageUrls.length
  // so we fire a no-op to satisfy the prop contract without a spurious update.
  const handleLoadSuccess = isPerPage
    ? (_data: { numPages: number }) => {}
    : onDocLoadSuccess;

  const resolvedPageCount = isPerPage ? pageUrls.length : pageCount;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <Document
        file={pdfUrl}
        onLoadSuccess={handleLoadSuccess}
        loading={
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        }
        key={documentKey}
      >
        {resolvedPageCount === 0 && (
          <div className="hidden">
            <Page pageNumber={1} width={1} />
          </div>
        )}
        {resolvedPageCount > 0 && (
          <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
            {/* Toolbar */}
            <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={onGoPrev}
                  disabled={selectedPdfIndex <= 0}
                  className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  Page {selectedPdfIndex + 1} of {resolvedPageCount}
                </span>
                <button
                  onClick={onGoNext}
                  disabled={selectedPdfIndex >= resolvedPageCount - 1}
                  className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <span className="text-xs text-[#017C87] font-medium truncate ml-2">
                {/* In per-page mode prefer the label from pageUrls; fall back to entries */}
                {isPerPage
                  ? (pageUrls[selectedPdfIndex]?.label || entries[selectedPdfIndex]?.name || '')
                  : (entries[selectedPdfIndex]?.name || '')}
              </span>
            </div>

            {/* Page preview */}
            <div className="flex-1 min-h-0 overflow-hidden bg-white flex items-center justify-center p-2">
              <Page
                pageNumber={pageNumber}
                width={previewWidth - 16}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                className="max-h-full"
                loading={
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={20} className="animate-spin text-gray-300" />
                  </div>
                }
              />
            </div>
          </div>
        )}
      </Document>
    </div>
  );
}