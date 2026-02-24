// components/viewer/TemplatePdfViewer.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { CompanyBranding } from '@/hooks/useProposal';
import ViewerLoader from '@/components/viewer/ViewerLoader';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TemplatePdfViewerProps {
  /** Map of PDF page number (1-based) → signed URL */
  pageUrls: Record<number, string>;
  /** The current PDF page to display (1-based, from toPdfPage) */
  currentPdfPage: number;
  scrollRef: React.RefObject<HTMLDivElement>;
  bgColor?: string;
  accentColor?: string;
  branding?: CompanyBranding;
}

export default function TemplatePdfViewer({
  pageUrls,
  currentPdfPage,
  scrollRef,
  bgColor = '#0f0f0f',
  accentColor = '#ff6700',
  branding,
}: TemplatePdfViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [nativePdfWidth, setNativePdfWidth] = useState<number | null>(null);
  const [renderedPage, setRenderedPage] = useState(currentPdfPage);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scale, setScale] = useState(1);
  const [loadingPage, setLoadingPage] = useState(true);

  // Track pinch-to-zoom
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  const currentUrl = pageUrls[currentPdfPage] || null;

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

  // When page changes, start transition and reset zoom
  useEffect(() => {
    if (currentPdfPage !== renderedPage) {
      setIsTransitioning(true);
      setScale(1);
      setLoadingPage(true);
    }
  }, [currentPdfPage, renderedPage]);

  const handlePageRenderSuccess = useCallback(() => {
    setRenderedPage(currentPdfPage);
    setLoadingPage(false);
    requestAnimationFrame(() => {
      setIsTransitioning(false);
    });
  }, [currentPdfPage]);

  const handlePageLoadSuccess = useCallback(
    (page: { originalWidth: number }) => {
      if (nativePdfWidth === null) {
        setNativePdfWidth(Math.round(page.originalWidth * 1.5));
      }
    },
    [nativePdfWidth]
  );

  // Pinch-to-zoom
  const getTouchDist = (t0: React.Touch, t1: React.Touch) => {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          startDist: getTouchDist(e.touches[0], e.touches[1]),
          startScale: scale,
        };
      }
    },
    [scale]
  );

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

  const renderWidth = nativePdfWidth
    ? Math.min(containerWidth, nativePdfWidth)
    : containerWidth;

  const showZoomControls = scale !== 1;

  // Preload adjacent pages (hidden Documents that warm the browser cache)
  const preloadPages = [currentPdfPage - 1, currentPdfPage + 1].filter(
    (p) => p > 0 && pageUrls[p]
  );

  // Show branded loader while page is loading (if branding available)
  const showBrandedLoader = loadingPage && branding && currentUrl;

  return (
    <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      {/* Branded loader overlay while PDF page loads */}
      {showBrandedLoader && (
        <ViewerLoader
          branding={branding}
          loading={loadingPage}
          label="Loading page…"
          minDisplayTime={600}
        />
      )}

      {/* Branded loader when no URL yet */}
      {!currentUrl && branding && (
        <ViewerLoader
          branding={branding}
          loading={true}
          label="Loading…"
          minDisplayTime={600}
        />
      )}

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
            {currentUrl ? (
              <Document
                key={currentUrl}
                file={currentUrl}
                loading={<></>}
              >
                {containerWidth > 0 && (
                  <div
                    className="transition-opacity duration-[600ms] ease-in-out mx-auto"
                    style={{ opacity: isTransitioning ? 0 : 1, maxWidth: renderWidth }}
                  >
                    <Page
                      pageNumber={1}
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
              /* Fallback: empty space — ViewerLoader overlay handles the visual */
              <div className="py-20" />
            )}
          </div>
        </div>
      </div>

      {/* Hidden preload for adjacent pages */}
      <div className="hidden">
        {preloadPages.map((p) => (
          <Document key={pageUrls[p]} file={pageUrls[p]}>
            <Page pageNumber={1} width={0} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        ))}
      </div>

      {/* Zoom controls — always visible on mobile (vertical), only when zoomed on desktop (horizontal) */}
      <div
        className={`absolute z-10 transition-opacity duration-200 ${
          showZoomControls ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:pointer-events-none'
        } top-14 right-2 flex flex-col items-center gap-1 lg:top-3 lg:right-3 lg:flex-row`}
      >
        <div
          className="flex flex-col lg:flex-row items-center gap-1 backdrop-blur-sm rounded-lg px-1 py-1 border shadow-lg shadow-black/20"
          style={{ backgroundColor: `${bgColor}e6`, borderColor: `${accentColor}40` }}
        >
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: accentColor }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-xs font-medium rounded-md transition-colors"
            style={{ color: accentColor }}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: accentColor }}
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}