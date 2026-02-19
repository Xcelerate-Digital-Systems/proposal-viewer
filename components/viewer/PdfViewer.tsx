// components/viewer/PdfViewer.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string | null;
  currentPage: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export default function PdfViewer({ pdfUrl, currentPage, onLoadSuccess, scrollRef }: PdfViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [nativePdfWidth, setNativePdfWidth] = useState<number | null>(null);
  const [renderedPage, setRenderedPage] = useState(currentPage);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When currentPage changes, start transition
  useEffect(() => {
    if (currentPage !== renderedPage) {
      setIsTransitioning(true);
    }
  }, [currentPage, renderedPage]);

  const handlePageRenderSuccess = useCallback(() => {
    // New page has rendered — complete the transition
    setRenderedPage(currentPage);
    // Small delay to let the canvas paint before fading in
    requestAnimationFrame(() => {
      setIsTransitioning(false);
    });
  }, [currentPage]);

  // Capture native PDF page width on first load
  const handlePageLoadSuccess = useCallback((page: { originalWidth: number }) => {
    if (nativePdfWidth === null) {
      // PDF points are 72 DPI; scale up to ~150 DPI for crisp rendering
      setNativePdfWidth(Math.round(page.originalWidth * 1.5));
    }
  }, [nativePdfWidth]);

  // Never render wider than the PDF's native width (scaled)
  const renderWidth = nativePdfWidth
    ? Math.min(containerWidth, nativePdfWidth)
    : containerWidth;

  return (
    <div className="flex-1 relative overflow-hidden bg-[#0f0f0f]">
      <div ref={scrollRef} className="absolute inset-0 overflow-auto">
        <div ref={contentRef} className="w-full">
          {pdfUrl ? (
            <Document
              file={pdfUrl}
              onLoadSuccess={onLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20 gap-3 text-[#666]">
                  <Loader2 className="animate-spin text-[#ff6700]" size={20} />
                  <span>Loading proposal...</span>
                </div>
              }
            >
              {containerWidth > 0 && (
                <div
                  className="transition-opacity duration-200 ease-in-out mx-auto"
                  style={{ opacity: isTransitioning ? 0 : 1, maxWidth: renderWidth }}
                >
                  <Page
                    pageNumber={currentPage}
                    width={renderWidth}
                    className="[&_canvas]:!w-full"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={handlePageRenderSuccess}
                    onLoadSuccess={handlePageLoadSuccess}
                    loading={<></>}
                  />
                </div>
              )}
            </Document>
          ) : (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-[#ff6700]" size={24} />
            </div>
          )}
        </div>
      </div>

      {/* Loading indicator — centered within PDF viewer visible frame */}
      {isTransitioning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex items-center gap-2.5 bg-[#1a1a1a]/80 backdrop-blur-sm px-4 py-2 rounded-full border border-[#2a2a2a]">
            <Loader2 className="animate-spin text-[#ff6700]" size={16} />
            <span className="text-xs text-[#999]">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}