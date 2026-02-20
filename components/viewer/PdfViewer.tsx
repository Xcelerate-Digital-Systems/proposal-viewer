// components/viewer/PdfViewer.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string | null;
  currentPage: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  bgColor?: string;
  accentColor?: string;
}

export default function PdfViewer({ pdfUrl, currentPage, onLoadSuccess, scrollRef, bgColor = '#0f0f0f', accentColor = '#ff6700' }: PdfViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [nativePdfWidth, setNativePdfWidth] = useState<number | null>(null);
  const [renderedPage, setRenderedPage] = useState(currentPage);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scale, setScale] = useState(1);

  // Track pinch-to-zoom
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

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

  // When currentPage changes, start transition and reset zoom
  useEffect(() => {
    if (currentPage !== renderedPage) {
      setIsTransitioning(true);
      setScale(1); // reset zoom on page change
    }
  }, [currentPage, renderedPage]);

  const handlePageRenderSuccess = useCallback(() => {
    setRenderedPage(currentPage);
    requestAnimationFrame(() => {
      setIsTransitioning(false);
    });
  }, [currentPage]);

  // Capture native PDF page width on first load
  const handlePageLoadSuccess = useCallback((page: { originalWidth: number }) => {
    if (nativePdfWidth === null) {
      setNativePdfWidth(Math.round(page.originalWidth * 1.5));
    }
  }, [nativePdfWidth]);

  // Pinch-to-zoom touch handlers
  const getTouchDist = (t0: React.Touch, t1: React.Touch) => {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        startDist: getTouchDist(e.touches[0], e.touches[1]),
        startScale: scale,
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const ratio = dist / pinchRef.current.startDist;
      const newScale = Math.min(3, Math.max(0.5, pinchRef.current.startScale * ratio));
      setScale(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(3, s + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(0.5, s - 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
  }, []);

  // Never render wider than the PDF's native width (scaled)
  const renderWidth = nativePdfWidth
    ? Math.min(containerWidth, nativePdfWidth)
    : containerWidth;

  const showZoomControls = scale !== 1;

  return (
    <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={zoomContainerRef}
          className="min-h-full flex items-center justify-center"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center top',
            transition: pinchRef.current ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <div ref={contentRef} className="w-full">
            {pdfUrl ? (
              <Document
                file={pdfUrl}
                onLoadSuccess={onLoadSuccess}
                loading={
                  <div className="flex items-center justify-center py-20 gap-3 text-[#666]">
                    <Loader2 className="animate-spin" size={20} style={{ color: accentColor }} />
                    <span>Loading proposal...</span>
                  </div>
                }
              >
                {containerWidth > 0 && (
                  <div
                    className="transition-opacity duration-[600ms] ease-in-out mx-auto"
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
                <Loader2 className="animate-spin" size={24} style={{ color: accentColor }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom controls — appear when zoomed */}
      {showZoomControls && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 backdrop-blur-sm rounded-lg px-1 py-1 border shadow-lg shadow-black/20 z-10"
          style={{ backgroundColor: `${bgColor}e6`, borderColor: `${accentColor}40` }}
        >
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: accentColor }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-xs font-medium rounded-md transition-colors"
            style={{ color: accentColor }}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: accentColor }}
          >
            <ZoomIn size={16} />
          </button>
        </div>
      )}
    </div>
  );
}