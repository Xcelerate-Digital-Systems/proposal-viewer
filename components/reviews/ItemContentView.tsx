// components/reviews/ItemContentView.tsx
'use client';

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Globe,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
} from 'lucide-react';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/reviews/AdMockupPreview';
import EmailMockupPreview from '@/components/admin/reviews/EmailMockupPreview';
import SmsMockupPreview from '@/components/admin/reviews/SmsMockupPreview';
import GoogleAdMockupPreview from '@/components/admin/reviews/GoogleAdMockupPreview';
import PinOverlay from './PinOverlay';
import { HighlightOverlay } from '@/components/reviews/feedback';
import type { ReviewItem, ReviewComment } from '@/lib/supabase';
import type { GoogleAdFormat } from '@/lib/types/review';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

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
  /** Render prop for webpage items — optional override */
  renderWebpage?: (item: ReviewItem) => React.ReactNode;
  /** Share token for building embed script URL */
  shareToken?: string;
  /** Empty state text */
  emptyText?: string;
  /** Text highlight comments for email/SMS content */
  highlightComments?: ReviewComment[];
  /** Currently highlighted comment ID */
  highlightedCommentId?: string | null;
  /** Click a text highlight → navigate to comment */
  onHighlightClick?: (commentId: string) => void;
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
  emptyText = 'No preview available',
  highlightComments = [],
  highlightedCommentId,
  onHighlightClick,
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
  const isEmail = item.type === 'email';
  const isWebpage = item.type === 'webpage';
  const imageUrl = item.image_url || item.screenshot_url;

  // Email items — render the email mockup preview with pin overlay
  if (isEmail) {
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-auto"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        <EmailContentView item={item} />
        <PinOverlay
          pinComments={pinComments}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={highlightComments}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
        />
      </div>
    );
  }

  // SMS items — render the SMS mockup preview with pin overlay
  if (item.type === 'sms') {
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        <SmsMockupPreview
          body={item.sms_body || ''}
          senderName="Your Brand"
          client="imessage"
          showClientToggle
        />
        <PinOverlay
          pinComments={pinComments}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={highlightComments}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
        />
      </div>
    );
  }

  // Video items — render video player with pin overlay
  if (item.type === 'video') {
    const videoSrc = item.video_url || item.image_url || '';
    const isYouTube = /youtube\.com|youtu\.be/.test(videoSrc);
    const isVimeo = /vimeo\.com/.test(videoSrc);
    const youtubeId = videoSrc.match(/(?:youtu\.be\/|v=)([\w-]+)/)?.[1];
    const vimeoId = videoSrc.match(/vimeo\.com\/(\d+)/)?.[1];

    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-3xl mx-auto"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        {isYouTube && youtubeId ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              className="absolute inset-0 w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : isVimeo && vimeoId ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}`}
              className="absolute inset-0 w-full h-full rounded-lg"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : videoSrc ? (
          <video
            src={videoSrc}
            controls
            className="w-full max-h-[calc(100dvh-120px)] rounded-lg"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText size={40} className="mb-3" />
            <p className="text-sm">No video source available</p>
          </div>
        )}
        <PinOverlay
          pinComments={pinComments}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
      </div>
    );
  }

  // PDF items — render PDF embed with pin overlay
  if (item.type === 'pdf') {
    const pdfSrc = item.pdf_url || item.image_url || '';

    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-3xl mx-auto"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        {pdfSrc ? (
          <iframe
            src={pdfSrc}
            className="w-full rounded-lg border border-gray-200"
            style={{ height: 'calc(100dvh - 120px)' }}
            title={item.title}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText size={40} className="mb-3" />
            <p className="text-sm">No PDF available</p>
          </div>
        )}
        <PinOverlay
          pinComments={pinComments}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
      </div>
    );
  }

  // Google Ad items — render Google Ad mockup with pin overlay
  if (item.type === 'google_ad') {
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-auto"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        <GoogleAdMockupPreview
          format={(item.google_ad_format as GoogleAdFormat) || 'search'}
          headline={item.google_ad_headline || item.ad_headline || ''}
          description1={item.google_ad_description1 || ''}
          description2={item.google_ad_description2 || ''}
          displayUrl={item.google_ad_display_url || 'www.example.com'}
          finalUrl={item.google_ad_final_url || ''}
          creativeUrl={item.ad_creative_url || ''}
          showFormatToggle
        />
        <PinOverlay
          pinComments={pinComments}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={highlightComments}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
        />
      </div>
    );
  }

  // Webpage items — show embed code & status
  if (isWebpage) {
    if (renderWebpage) return <>{renderWebpage(item)}</>;
    return (
      <WebpageEmbedView
        item={item}
        shareToken={shareToken || ''}
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
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={highlightComments}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
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
/*  Email content view — renders the email mockup with client toggle   */
/* ================================================================== */

function EmailContentView({
  item,
}: {
  item: ReviewItem;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <EmailMockupPreview
        subject={item.email_subject || ''}
        preheader={item.email_preheader || ''}
        body={item.email_body || ''}
        senderName="Your Brand"
        client="inbox_preview"
        showClientToggle
      />
    </div>
  );
}

/* ================================================================== */
/*  Webpage embed view — shows embed code, install status, open link   */
/* ================================================================== */

function WebpageEmbedView({
  item,
  shareToken,
}: {
  item: ReviewItem;
  shareToken: string;
}) {
  const [copied, setCopied] = useState(false);

  const apiBase = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || '';

  const scriptTag = shareToken && item.id
    ? `<script src="${apiBase}/api/review-widget/${shareToken}/script?item=${item.id}" defer><\/script>`
    : '';

  const isInstalled = !!item.widget_installed_at;

  const handleCopy = async () => {
    if (!scriptTag) return;
    try {
      await navigator.clipboard.writeText(scriptTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = scriptTag;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 flex items-center justify-center mx-auto mb-4">
            <Globe size={24} className="text-teal" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Feedback Widget
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Embed this script on your page to enable the feedback widget.
            Visitors can leave comments, take screenshots, and record their screen.
          </p>
        </div>

        {/* Installation status */}
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            isInstalled
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">Widget installed</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Detected on {new Date(item.widget_installed_at!).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            </>
          ) : (
            <>
              <Clock size={18} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">Awaiting installation</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Add the script below to your page&apos;s <code className="font-mono">&lt;head&gt;</code> tag
                </p>
              </div>
            </>
          )}
        </div>

        {/* Embed code */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Code2 size={13} />
              Embed Code
            </label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-teal hover:bg-teal/5 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <div
            onClick={handleCopy}
            className="relative bg-gray-900 rounded-xl p-4 cursor-pointer group"
          >
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
              {scriptTag || '/* Missing share token or item ID */'}
            </pre>
            <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-teal/30 transition-colors" />
          </div>
        </div>

        {/* Open page button */}
        {item.url && (
          <div className="flex items-center justify-center gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal hover:bg-[#015c64] transition-colors"
            >
              <ExternalLink size={14} />
              Open Page
            </a>
          </div>
        )}

        {/* URL display */}
        {item.url && (
          <p className="text-center text-xs text-gray-400 truncate px-4">
            {item.url}
          </p>
        )}
      </div>
    </div>
  );
}