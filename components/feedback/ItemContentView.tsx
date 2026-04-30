'use client';

import React from 'react';
import { Image as ImageIcon, FileText } from 'lucide-react';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import EmailMockupPreview from '@/components/admin/feedback/EmailMockupPreview';
import SmsMockupPreview from '@/components/admin/feedback/SmsMockupPreview';
import GoogleAdMockupPreview from '@/components/admin/feedback/GoogleAdMockupPreview';
import MetaLeadFormMockupPreview from '@/components/admin/feedback/MetaLeadFormMockupPreview';
import PinOverlay from './PinOverlay';
import { HighlightOverlay } from '@/components/feedback/tools';
import WebpageEmbedView from './item-content/WebpageEmbedView';
import WebpagePreviewView from './item-content/WebpagePreviewView';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';
import type { GoogleAdFormat } from '@/lib/types/feedback';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface ItemContentViewProps {
  item: FeedbackItem | null;
  /** Whether user is placing a pin */
  placingPin: boolean;
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
  /** Brand accent color — applied to mockup preview toggles (Inbox/Email, FB/IG, etc.) */
  accentColor?: string;
  /** Business / brand name — shown as the page/sender name in ad, email and SMS mockups. */
  brandName?: string;
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
  accentColor,
  brandName,
}: ItemContentViewProps) {
  const displayBrandName = brandName?.trim() || 'Your Brand';
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
        <EmailContentView item={item} accentColor={accentColor} brandName={displayBrandName} />
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
          senderName={displayBrandName}
          client="imessage"
          showClientToggle
          accentColor={accentColor}
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
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto"
        style={{ cursor: placingPin ? 'crosshair' : 'default' }}
        onClick={onImageClick}
      >
        <MetaLeadFormMockupPreview
          data={data}
          accentColor={accentColor}
        />
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
          accentColor={accentColor}
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
              pageName={displayBrandName}
              showPlatformToggle
              accentColor={accentColor}
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
  accentColor,
  brandName,
}: {
  item: FeedbackItem;
  accentColor?: string;
  brandName?: string;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <EmailMockupPreview
        subject={item.email_subject || ''}
        preheader={item.email_preheader || ''}
        body={item.email_body || ''}
        senderName={brandName || 'Your Brand'}
        client="inbox_preview"
        showClientToggle
        accentColor={accentColor}
      />
    </div>
  );
}
