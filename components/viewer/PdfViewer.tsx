// components/viewer/PdfViewer.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { CompanyBranding, PageUrlEntry } from '@/hooks/useProposal';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import ViewerBackground from '@/components/viewer/ViewerBackground';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  /** Legacy single signed URL (populated in fallback mode only) */
  pdfUrl: string | null;
  /** Per-page signed URL entries (primary path post-migration) */
  pageUrls?: PageUrlEntry[];
  /** Current virtual PDF page number (1-based) */
  currentPage: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  bgColor?: string;
  accentColor?: string;
  branding?: CompanyBranding;
}

export default function PdfViewer({
  pdfUrl,
  pageUrls = [],
  currentPage,
  onLoadSuccess,
  scrollRef,
  bgColor = '#0f0f0f',
  accentColor = '#01434A',
  branding,
}: PdfViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [nativePdfWidth, setNativePdfWidth] = useState<number | null>(null);
  const [renderedPage, setRenderedPage] = useState(currentPage);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scale, setScale] = useState(1);
  const [documentLoading, setDocumentLoading] = useState(true);

  // Whether we are in per-page mode or legacy single-PDF mode
  const isPerPage = pageUrls.length > 0;

  // In per-page mode the active URL is indexed by currentPage
  const activePageUrl = isPerPage ? (pageUrls[currentPage - 1]?.url ?? null) : null;

  // Track pinch-to-zoom
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  // ── Container width measurement ──────────────────────────────────
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

  // ── Page transition on change ────────────────────────────────────
  useEffect(() => {
    if (currentPage !== renderedPage) {
      setIsTransitioning(true);
      setScale(1); // reset zoom on page change
      // In per-page mode each URL change remounts the Document, so reset loading
      if (isPerPage) setDocumentLoading(true);
    }
  }, [currentPage, renderedPage, isPerPage]);

  // ── Adjacent-page prefetch (per-page mode only) ──────────────────
  // Injects <link rel="prefetch"> for prev and next page URLs so the
  // browser warms its cache before the user navigates to them.
  useEffect(() => {
    if (!isPerPage) return;

    const toFetch = [
      pageUrls[currentPage]?.url,     // next page (currentPage is 1-based → index = currentPage)
      pageUrls[currentPage - 2]?.url, // prev page (index = currentPage - 2)
    ].filter(Boolean) as string[];

    const links: HTMLLinkElement[] = [];
    for (const url of toFetch) {
      const link = window.document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'fetch';
      link.href = url;
      link.crossOrigin = 'anonymous';
      window.document.head.appendChild(link);
      links.push(link);
    }

    return () => {
      for (const link of links) {
        link.remove();
      }
    };
  }, [isPerPage, currentPage, pageUrls]);

  // ── Document load success ────────────────────────────────────────
  const handleDocumentLoadSuccess = useCallback(
    (data: { numPages: number }) => {
      setDocumentLoading(false);
      onLoadSuccess(data);
    },
    [onLoadSuccess]
  );

  // ── Page render success ──────────────────────────────────────────
  const handlePageRenderSuccess = useCallback(() => {
    setRenderedPage(currentPage);
    requestAnimationFrame(() => {
      setIsTransitioning(false);
    });
  }, [currentPage]);

  // ── Capture native PDF page width on first load ──────────────────
  const handlePageLoadSuccess = useCallback(
    (page: { originalWidth: number }) => {
      if (nativePdfWidth === null) {
        setNativePdfWidth(Math.round(page.originalWidth * 1.5));
      }
    },
    [nativePdfWidth]
  );

  // ── Pinch-to-zoom ────────────────────────────────────────────────
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

  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.25)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.5, s - 0.25)), []);
  const resetZoom = useCallback(() => setScale(1), []);

  // Never render wider than the PDF's native width (scaled)
  const renderWidth = nativePdfWidth
    ? Math.min(containerWidth, nativePdfWidth)
    : containerWidth;

  const showZoomControls = scale !== 1;

  // Determine what URL to pass to the Document
  const fileUrl = isPerPage ? activePageUrl : pdfUrl;

  // Show branded loader while PDF is loading
  const showBrandedLoader = documentLoading && branding && fileUrl;

  return (
    <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      {branding && <ViewerBackground branding={branding} />}

      {/* Branded loader overlay while PDF loads */}
      {showBrandedLoader && (
        <ViewerLoader
          branding={branding}
          loading={documentLoading}
          label="Loading…"
          minDisplayTime={600}
        />
      )}

      {/* Branded loader when no URL yet */}
      {!fileUrl && branding && (
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
            {fileUrl ? (
              <Document
                // In per-page mode, key on the URL so react-pdf fully remounts
                // on page change — prevents stale page flash during transitions.
                key={isPerPage ? fileUrl : undefined}
                file={fileUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                loading={<></>}
              >
                {containerWidth > 0 && (
                  <div
                    className="transition-opacity duration-[600ms] ease-in-out mx-auto"
                    style={{ opacity: isTransitioning ? 0 : 1, maxWidth: renderWidth }}
                  >
                    <Page
                      // In per-page mode every Document has only page 1
                      pageNumber={isPerPage ? 1 : currentPage}
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

      {/* Zoom controls */}
      <div
        className={`absolute z-10 transition-opacity duration-200 ${
          showZoomControls
            ? 'opacity-100'
            : 'opacity-100 lg:opacity-0 lg:pointer-events-none'
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