'use client';

import React, { useMemo } from 'react';
import { Image as ImageIcon, FileText } from 'lucide-react';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import EmailMockupPreview, { type EmailClient } from '@/components/admin/feedback/EmailMockupPreview';
import SmsMockupPreview, { type SmsClient } from '@/components/admin/feedback/SmsMockupPreview';
import GoogleSearchAdMockupPreview from '@/components/admin/feedback/GoogleSearchAdMockupPreview';
import GoogleBannerAdMockupPreview from '@/components/admin/feedback/GoogleBannerAdMockupPreview';
import { emptyGoogleAdData } from '@/lib/types/feedback';
import MetaLeadFormMockupPreview, { type MetaLeadFormPage } from '@/components/admin/feedback/MetaLeadFormMockupPreview';
import PinOverlay from './PinOverlay';
import { HighlightOverlay } from '@/components/feedback/tools';
import WebpageEmbedView from './item-content/WebpageEmbedView';
import WebpagePreviewView from './item-content/WebpagePreviewView';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';
import {
  type FeedbackItemView,
  defaultViewForItem,
  getCommentView,
} from '@/lib/types/feedback';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface ItemContentViewProps {
  item: FeedbackItem | null;
  /** CSS cursor for the content surface — varies by active feedback tool */
  cursorStyle?: string;
  /** Current pending pin position (image/ad items only) */
  pendingPin: { x: number; y: number } | null;
  /** Top-level pin comments */
  pinComments: FeedbackComment[];
  /** Callback when user clicks on the content area to place a pin (image/ad items) */
  onImageClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Callback when existing pin marker is clicked */
  onPinClick: (commentId?: string) => void;
  /** Optional ref for the container */
  containerRef?: React.RefObject<HTMLDivElement>;
  /** Render prop for webpage items — optional override */
  renderWebpage?: (item: FeedbackItem) => React.ReactNode;
  /** Share token for building embed script URL */
  shareToken?: string;
  /** Empty state text */
  emptyText?: string;
  /** Text highlight comments for email/SMS content */
  highlightComments?: FeedbackComment[];
  /** Currently highlighted comment ID */
  highlightedCommentId?: string | null;
  /** Click a text highlight → navigate to comment */
  onHighlightClick?: (commentId: string) => void;
  /** In-progress highlight (teal) shown while reviewer composes */
  pendingHighlight?: { start: number; end: number } | null;
  /** Brand accent color — applied to mockup preview toggles (Inbox/Email, FB/IG, etc.) */
  accentColor?: string;
  /** Business / brand name — shown as the page/sender name in ad, email and SMS mockups. */
  brandName?: string;
  /** Currently active sub-view of the mockup (e.g. lead-form page, email
   *  client, ad platform). Controlled — when null, defaults to the item's
   *  natural starting view via `defaultViewForItem()`. */
  activeView?: FeedbackItemView;
  /** Notify the parent when the user toggles a sub-view. The parent stores
   *  this so pin/highlight/drawing creation can scope to the active view. */
  onViewChange?: (view: FeedbackItemView) => void;
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function ItemContentView({
  item,
  cursorStyle = 'default',
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
  pendingHighlight,
  accentColor,
  brandName,
  activeView,
  onViewChange,
}: ItemContentViewProps) {
  const displayBrandName = brandName?.trim() || 'Your Brand';

  // Resolve the controlled view, falling back to each item's natural default.
  // For items with no sub-views (image, video, pdf, webpage) this stays null
  // and the per-branch pin filter is bypassed.
  const currentView = useMemo<FeedbackItemView>(
    () => (activeView !== undefined ? activeView : (item ? defaultViewForItem(item) : null)),
    [activeView, item],
  );

  // For sub-view-scoped mockups, only show pins / highlights placed on the
  // current view. Single-view items pass through unchanged.
  const visiblePins = useMemo(() => {
    if (currentView == null) return pinComments;
    return pinComments.filter((c) => getCommentView(c.annotation_data) === currentView);
  }, [pinComments, currentView]);
  const visibleHighlights = useMemo(() => {
    if (currentView == null) return highlightComments;
    return highlightComments.filter((c) => getCommentView(c.annotation_data) === currentView);
  }, [highlightComments, currentView]);

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
    const client = (currentView as EmailClient | null) || 'inbox_preview';
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-auto"
        style={{ cursor: cursorStyle }}
        onClick={onImageClick}
      >
        <EmailMockupPreview
          subject={item.email_subject || ''}
          preheader={item.email_preheader || ''}
          body={item.email_body || ''}
          senderName={displayBrandName}
          client={client}
          showClientToggle
          accentColor={accentColor}
          onClientChange={(c) => onViewChange?.(c)}
        />
        <PinOverlay
          pinComments={visiblePins}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={visibleHighlights}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
          pendingHighlight={pendingHighlight}
        />
      </div>
    );
  }

  // SMS items — render the SMS mockup preview with pin overlay
  if (item.type === 'sms') {
    const client = (currentView as SmsClient | null) || 'imessage';
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto"
        style={{ cursor: cursorStyle }}
        onClick={onImageClick}
      >
        <SmsMockupPreview
          body={item.sms_body || ''}
          senderName={displayBrandName}
          client={client}
          showClientToggle
          accentColor={accentColor}
          onClientChange={(c) => onViewChange?.(c)}
        />
        <PinOverlay
          pinComments={visiblePins}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={visibleHighlights}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
          pendingHighlight={pendingHighlight}
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
        style={{ cursor: cursorStyle }}
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
        style={{ cursor: cursorStyle }}
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

  // Meta Lead Form items — render multi-page lead form mockup with pin overlay
  if (item.type === 'meta_lead_form') {
    const data = item.meta_lead_form_data;
    if (!data) {
      return (
        <div className="text-center">
          <ImageIcon size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Lead form not configured</p>
        </div>
      );
    }
    const page = (currentView as MetaLeadFormPage | null) || 'intro';
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto"
        style={{ cursor: cursorStyle }}
        onClick={onImageClick}
      >
        <MetaLeadFormMockupPreview
          data={data}
          page={page}
          onPageChange={(p) => onViewChange?.(p)}
          accentColor={accentColor}
        />
        <PinOverlay
          pinComments={visiblePins}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
      </div>
    );
  }

  // Google Search / Banner ad items — render the matching mockup with pin overlay.
  // Both reads come from the shared google_ad_data jsonb; the discriminator is item.type.
  if (item.type === 'google_search_ad' || item.type === 'google_banner_ad') {
    const data = item.google_ad_data || emptyGoogleAdData();
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-auto flex justify-center"
        style={{ cursor: cursorStyle }}
        onClick={onImageClick}
      >
        {item.type === 'google_search_ad' ? (
          <GoogleSearchAdMockupPreview data={data} />
        ) : (
          <GoogleBannerAdMockupPreview
            headline={data.headlines?.[0] || item.ad_headline || ''}
            displayUrl={data.display_url || ''}
            creativeUrl={data.banner_image_url || item.ad_creative_url || ''}
          />
        )}
        <PinOverlay
          pinComments={visiblePins}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={visibleHighlights}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
          pendingHighlight={pendingHighlight}
        />
      </div>
    );
  }

  // Webpage items — screenshot only. The widget on the live page is the only
  // feedback surface; we never render a live iframe of the customer's page in-app.
  if (isWebpage) {
    if (renderWebpage) return <>{renderWebpage(item)}</>;
    if (item.screenshot_url) {
      return (
        <WebpagePreviewView
          item={item}
          shareToken={shareToken || ''}
          containerRef={containerRef}
          pinComments={pinComments}
          onPinClick={onPinClick}
        />
      );
    }
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
        style={{ cursor: cursorStyle }}
        onClick={onImageClick}
      >
        {/* Ad mockup */}
        {isAd && (
          <div>
            <AdMockupPreview
              creativeUrl={item.ad_creative_url!}
              headline={item.ad_headline || ''}
              primaryText={item.ad_copy || ''}
              ctaText={item.ad_cta || 'Learn More'}
              platform={(currentView as AdPlatform | null) || (item.ad_platform as AdPlatform) || 'facebook_feed'}
              pageName={displayBrandName}
              showPlatformToggle
              accentColor={accentColor}
              onPlatformChange={(p) => onViewChange?.(p)}
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
          pinComments={visiblePins}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement>}
          highlightComments={visibleHighlights}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
          pendingHighlight={pendingHighlight}
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

