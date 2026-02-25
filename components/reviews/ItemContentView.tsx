// components/reviews/ItemContentView.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Globe, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/reviews/AdMockupPreview';
import PinOverlay from './PinOverlay';
import type { ReviewItem, ReviewComment } from '@/lib/supabase';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface WebpagePinPlacement {
  pin_x: number;
  pin_y: number;
  element_path: string;
}

interface ItemContentViewProps {
  item: ReviewItem | null;
  /** Whether user is placing a pin */
  placingPin: boolean;
  /** Current pending pin position (image/ad items only) */
  pendingPin: { x: number; y: number } | null;
  /** Top-level pin comments */
  pinComments: ReviewComment[];
  /** Callback when user clicks on the content area to place a pin (image/ad items) */
  onImageClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Callback when existing pin marker is clicked */
  onPinClick: (commentId?: string) => void;
  /** Optional ref for the container */
  containerRef?: React.RefObject<HTMLDivElement>;
  /** Render prop for webpage items — optional override (e.g. admin embed-code view) */
  renderWebpage?: (item: ReviewItem) => React.ReactNode;
  /** Share token for proxy access (webpage items) */
  shareToken?: string;
  /** Callback when a pin is placed on a webpage (via in-iframe click) */
  onWebpagePinPlaced?: (placement: WebpagePinPlacement) => void;
  /** All comments for this item (sent to iframe for rendering) */
  allComments?: ReviewComment[];
  /** Empty state text */
  emptyText?: string;
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function ItemContentView({
  item,
  placingPin,
  pendingPin,
  pinComments,
  onImageClick,
  onPinClick,
  containerRef,
  renderWebpage,
  shareToken,
  onWebpagePinPlaced,
  allComments,
  emptyText = 'No preview available',
}: ItemContentViewProps) {
  if (!item) {
    return (
      <div className="text-center">
        <ImageIcon size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">{emptyText}</p>
      </div>
    );
  }

  const isAd = item.type === 'ad' && item.ad_creative_url;
  const isWebpage = item.type === 'webpage';
  const imageUrl = item.image_url || item.screenshot_url;

  // Webpage items — render proxied iframe with in-iframe pins
  if (isWebpage) {
    if (renderWebpage) return <>{renderWebpage(item)}</>;
    return (
      <WebpageProxyView
        item={item}
        shareToken={shareToken || ''}
        placingPin={placingPin}
        pinComments={pinComments}
        allComments={allComments || pinComments}
        onPinPlaced={onWebpagePinPlaced}
        onPinClick={onPinClick}
        containerRef={containerRef}
      />
    );
  }

  // Ad or Image with pin overlay
  if (isAd || imageUrl) {
    return (
      <div
        ref={containerRef}
        className="relative max-w-full max-h-full"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        {/* Ad mockup */}
        {isAd && (
          <div className="select-none">
            <AdMockupPreview
              creativeUrl={item.ad_creative_url!}
              headline={item.ad_headline || ''}
              primaryText={item.ad_copy || ''}
              ctaText={item.ad_cta || 'Learn More'}
              platform={(item.ad_platform as AdPlatform) || 'facebook_feed'}
              pageName="Your Brand"
              showPlatformToggle
            />
          </div>
        )}

        {/* Image (non-ad) */}
        {!isAd && imageUrl && (
          <img
            src={imageUrl}
            alt={item.title}
            className="max-w-full max-h-[calc(100dvh-120px)] object-contain rounded-lg select-none"
            draggable={false}
          />
        )}

        {/* Pin overlay */}
        <PinOverlay
          pinComments={pinComments}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className="text-center">
      <ImageIcon size={40} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-400">{emptyText}</p>
    </div>
  );
}

/* ================================================================== */
/*  Webpage proxy view — pins render inside iframe via injected script */
/* ================================================================== */

function WebpageProxyView({
  item,
  shareToken,
  placingPin,
  pinComments,
  allComments,
  onPinPlaced,
  onPinClick,
  containerRef,
}: {
  item: ReviewItem;
  shareToken: string;
  placingPin: boolean;
  pinComments: ReviewComment[];
  allComments: ReviewComment[];
  onPinPlaced?: (placement: WebpagePinPlacement) => void;
  onPinClick: (commentId?: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [iframeReady, setIframeReady] = useState(false);

  // Build proxy URL
  const proxyUrl = item.url && shareToken
    ? `/api/review-proxy?url=${encodeURIComponent(item.url)}&token=${encodeURIComponent(shareToken)}&item=${encodeURIComponent(item.id)}`
    : '';

  // ── Post message helper ──
  const postToIframe = useCallback(
    (msg: Record<string, unknown>) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(msg, '*');
      }
    },
    []
  );

  // ── Listen for messages from iframe ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || !d.type) return;

      switch (d.type) {
        case 'aviz-proxy-ready':
          setIframeReady(true);
          setStatus('loaded');
          break;

        case 'aviz-frame-info':
          // Could track scroll position if needed later
          if (status === 'loading') setStatus('loaded');
          break;

        case 'aviz-pin-placed':
          onPinPlaced?.({
            pin_x: d.pin_x,
            pin_y: d.pin_y,
            element_path: d.element_path || '',
          });
          break;

        case 'aviz-pin-clicked':
          onPinClick(d.commentId);
          break;

        case 'aviz-nav-blocked':
          // User clicked a link — could show a toast or ignore
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [status, onPinPlaced, onPinClick]);

  // ── Send mode changes to iframe ──
  useEffect(() => {
    if (!iframeReady) return;
    postToIframe({
      type: 'aviz-set-mode',
      mode: placingPin ? 'comment' : 'browse',
    });
  }, [placingPin, iframeReady, postToIframe]);

  // ── Send comments to iframe when they change ──
  useEffect(() => {
    if (!iframeReady) return;
    postToIframe({
      type: 'aviz-load-comments',
      comments: allComments.map((c) => ({
        id: c.id,
        comment_type: c.comment_type,
        pin_x: c.pin_x,
        pin_y: c.pin_y,
        thread_number: c.thread_number,
        resolved: c.resolved,
        parent_comment_id: c.parent_comment_id,
      })),
    });
  }, [allComments, iframeReady, postToIframe]);

  // ── Fallback: mark as loaded if no postMessage after a while ──
  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      setStatus((prev) => (prev === 'loading' ? 'loaded' : prev));
    }, 3000);
  }, []);

  // ── No proxy URL ──
  if (!proxyUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm px-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Missing configuration</h3>
          <p className="text-sm text-gray-500">
            This webpage item needs a URL and share token to load the review proxy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
    >
      {/* Loading state */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[1]">
          <div className="text-center">
            <Loader2 size={24} className="text-[#017C87] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading page…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[1]">
          <div className="text-center max-w-sm px-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-amber-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Failed to load page
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              The page couldn&apos;t be loaded through the proxy. You can still
              open it directly and leave general comments.
            </p>
            <a
              href={item.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#017C87] hover:bg-[#015c64] transition-colors"
            >
              <ExternalLink size={14} />
              Open in New Tab
            </a>
          </div>
        </div>
      )}

      {/* Proxied iframe — pins render INSIDE via injected script */}
      <iframe
        ref={iframeRef}
        src={proxyUrl}
        title={item.title}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={() => setStatus('error')}
        style={{ opacity: status === 'loaded' ? 1 : 0 }}
      />

      {/* URL bar at bottom */}
      {status === 'loaded' && !placingPin && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 border border-gray-200/60 shadow-sm backdrop-blur-sm max-w-[400px]">
          <Globe size={12} className="text-gray-400 shrink-0" />
          <span className="text-[11px] text-gray-500 truncate">{item.url}</span>
          <a
            href={item.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#017C87] hover:text-[#015c64] shrink-0"
            title="Open in new tab"
          >
            <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}