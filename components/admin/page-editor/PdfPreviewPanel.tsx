// components/admin/page-editor/PdfPreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, PageNameEntry } from '@/lib/supabase';

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
}: PdfPreviewPanelProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load signed URL
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setPdfUrl(data.signedUrl + '&v=' + Date.now());
    };
    load();
  }, [filePath, pdfVersion]);

  // Measure container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setPreviewWidth(Math.max(200, containerRef.current.offsetWidth - 2));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  if (!pdfUrl) {
    return (
      <div ref={containerRef} className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <Document file={pdfUrl} onLoadSuccess={onDocLoadSuccess} loading={null} key={pdfVersion}>
        {pageCount === 0 && <div className="hidden"><Page pageNumber={1} width={1} /></div>}
        {pageCount > 0 && (
          <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
            <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={onGoPrev} disabled={selectedPdfIndex <= 0}
                  className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  Page {selectedPdfIndex + 1} of {pageCount}
                </span>
                <button onClick={onGoNext} disabled={selectedPdfIndex >= pageCount - 1}
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
    </div>
  );
}