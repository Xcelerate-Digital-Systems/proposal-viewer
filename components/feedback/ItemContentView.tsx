'use client';

import React, { useMemo } from 'react';
import { Image as ImageIcon, FileText, Video, Film } from 'lucide-react';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import EmailMockupPreview, { type EmailClient } from '@/components/admin/feedback/EmailMockupPreview';
import SmsMockupPreview, { type SmsClient } from '@/components/admin/feedback/SmsMockupPreview';
import GoogleSearchAdMockupPreview from '@/components/admin/feedback/GoogleSearchAdMockupPreview';
import GoogleBannerAdMockupPreview from '@/components/admin/feedback/GoogleBannerAdMockupPreview';
import { emptyGoogleAdData } from '@/lib/types/feedback';
import MetaLeadFormMockupPreview, { type MetaLeadFormPage } from '@/components/admin/feedback/MetaLeadFormMockupPreview';
import PinOverlay from './PinOverlay';
import { HighlightOverlay } from '@/components/feedback/tools';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';
import {
  type FeedbackItemView,
  defaultViewForItem,
  getCommentView,
  getMetaAdVariants,
  metaAdVariantView,
  parseMetaAdVariantView,
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
  containerRef?: React.RefObject<HTMLDivElement | null>;
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
  /** Comment counts keyed by view string — used by Google Search ad sidebar
   *  to badge which assets already have feedback. */
  commentCountsByView?: Record<string, number>;
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
  commentCountsByView,
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
  // current view. Single-view items pass through unchanged. Pins with the
  // special `creative` view are *always* visible (they were placed on a
  // shared element — the Meta ad image — so the feedback applies across
  // every variant/platform). Highlights aren't relevant on the creative
  // image so they only honour the current-view filter.
  const visiblePins = useMemo(() => {
    if (currentView == null) return pinComments;
    return pinComments.filter((c) => {
      const v = getCommentView(c.annotation_data);
      return v === currentView || v === 'creative';
    });
  }, [pinComments, currentView]);
  const visibleHighlights = useMemo(() => {
    if (currentView == null) return highlightComments;
    return highlightComments.filter((c) => getCommentView(c.annotation_data) === currentView);
  }, [highlightComments, currentView]);

  if (!item) {
    return (
      <div className="max-w-3xl mx-auto bg-surface rounded-2xl shadow-card-soft flex flex-col items-center justify-center py-20">
        <ImageIcon size={32} className="text-faint mb-3" />
        <p className="text-caption font-medium text-ink">No item selected</p>
        <p className="text-detail text-muted mt-1">{emptyText}</p>
      </div>
    );
  }

  const isAd = item.type === 'ad' && item.ad_creative_url;
  const isEmail = item.type === 'email';
  const isWebpage = item.type === 'webpage';
  const imageUrl = item.image_url;

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
          containerRef={containerRef as React.RefObject<HTMLElement | null>}
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
          containerRef={containerRef as React.RefObject<HTMLElement | null>}
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
        {videoSrc ? (
          <div className="bg-surface rounded-2xl shadow-card-soft overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-edge">
              <div className="w-6 h-6 rounded-md bg-white shadow-card-soft flex items-center justify-center">
                <Film size={12} className="text-muted" />
              </div>
              <span className="text-caption font-medium text-ink truncate">{item.title || 'Video'}</span>
              <span className="text-detail text-faint ml-auto shrink-0">Video</span>
            </div>
            <div className="bg-ink/95">
              {isYouTube && youtubeId ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : isVimeo && vimeoId ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://player.vimeo.com/video/${vimeoId}`}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video
                  src={videoSrc}
                  controls
                  className="w-full max-h-[calc(100dvh-200px)]"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl shadow-card-soft flex flex-col items-center justify-center py-20">
            <Video size={32} className="text-faint mb-3" />
            <p className="text-caption font-medium text-ink">No video source</p>
            <p className="text-detail text-muted mt-1">Upload a video or paste a YouTube/Vimeo link to start reviewing.</p>
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
          <div className="bg-surface rounded-2xl shadow-card-soft overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-edge">
              <div className="w-6 h-6 rounded-md bg-white shadow-card-soft flex items-center justify-center">
                <FileText size={12} className="text-red-500" />
              </div>
              <span className="text-caption font-medium text-ink truncate">{item.title || 'Document'}</span>
              <span className="text-detail text-faint ml-auto shrink-0">PDF</span>
            </div>
            <iframe
              src={pdfSrc}
              className="w-full border-0"
              style={{ height: 'calc(100dvh - 200px)' }}
              title={item.title}
            />
          </div>
        ) : (
          <div className="bg-surface rounded-2xl shadow-card-soft flex flex-col items-center justify-center py-20">
            <FileText size={32} className="text-faint mb-3" />
            <p className="text-caption font-medium text-ink">No PDF uploaded</p>
            <p className="text-detail text-muted mt-1">Upload a PDF to start reviewing.</p>
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
        <div className="max-w-md mx-auto bg-surface rounded-2xl shadow-card-soft flex flex-col items-center justify-center py-20">
          <FileText size={32} className="text-faint mb-3" />
          <p className="text-caption font-medium text-ink">Lead form not configured</p>
          <p className="text-detail text-muted mt-1">Set up the form fields to start reviewing.</p>
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

  // Google Search / Banner ad items — render the matching mockup. Search ads
  // use the asset-sidebar flow (per-asset comments, no pins). Banner ads
  // still use the pin overlay since their content is a single image.
  // Both reads come from the shared google_ad_data jsonb; the discriminator is item.type.
  if (item.type === 'google_search_ad' || item.type === 'google_banner_ad') {
    const data = item.google_ad_data || emptyGoogleAdData();
    const isSearch = item.type === 'google_search_ad';
    return (
      <div
        ref={containerRef}
        className={`relative w-full mx-auto flex justify-center ${isSearch ? 'max-w-7xl' : 'max-w-2xl'}`}
        style={{ cursor: isSearch ? 'default' : cursorStyle }}
        onClick={isSearch ? undefined : onImageClick}
      >
        {isSearch ? (
          <GoogleSearchAdMockupPreview
            data={data}
            activeView={currentView}
            onViewChange={onViewChange}
            commentCountsByView={commentCountsByView}
          />
        ) : (
          <>
            <GoogleBannerAdMockupPreview
              headline={data.headlines?.[0] || item.ad_headline || ''}
              displayUrl={data.display_url || ''}
              creativeUrl={data.banner_image_url || item.ad_creative_url || ''}
            />
            <PinOverlay
              pinComments={visiblePins}
              pendingPin={pendingPin}
              onPinClick={onPinClick}
            />
            <HighlightOverlay
              containerRef={containerRef as React.RefObject<HTMLElement | null>}
              highlightComments={visibleHighlights}
              highlightedCommentId={highlightedCommentId}
              onHighlightClick={onHighlightClick}
              pendingHighlight={pendingHighlight}
            />
          </>
        )}
      </div>
    );
  }

  // Webpage items — render the live page in an iframe. The widget on the live
  // page is still the primary feedback surface; this in-app view is read-only
  // and shows pins captured by the widget.
  if (isWebpage) {
    if (renderWebpage) return <>{renderWebpage(item)}</>;
    if (!item.url) {
      return (
        <div className="max-w-3xl mx-auto bg-surface rounded-2xl shadow-card-soft flex flex-col items-center justify-center py-20">
          <ImageIcon size={32} className="text-faint mb-3" />
          <p className="text-caption font-medium text-ink">No page URL set</p>
          <p className="text-detail text-muted mt-1">Add a URL to start reviewing this page.</p>
        </div>
      );
    }
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full bg-white rounded-2xl border border-edge-strong overflow-hidden"
      >
        <iframe
          src={item.url}
          title={item.title}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          loading="lazy"
        />
        <PinOverlay
          pinComments={pinComments}
          pendingPin={null}
          onPinClick={onPinClick}
        />
      </div>
    );
  }

  // Ad or Image with pin overlay
  if (isAd || imageUrl) {
    return (
      <div
        ref={containerRef}
        className="relative max-w-3xl mx-auto"
        style={{ cursor: cursorStyle }}
        onClick={onImageClick}
      >
        {/* Ad mockup */}
        {isAd && (() => {
          // Resolve which variants to render. When the item has stored
          // variants we use them; otherwise fall back to a one-variant
          // shim synthesised from the legacy ad_headline / ad_copy columns
          // so existing items keep working unchanged.
          const variants = getMetaAdVariants(item);
          const parsed = parseMetaAdVariantView(currentView);
          const activeVariantId = parsed?.id && variants.some((v) => v.id === parsed.id)
            ? parsed.id
            : variants[0].id;
          // For legacy ads (no stored variants) the view stays platform-scoped
          // so existing pins keep showing. For variant ads the platform is a
          // pure UI toggle that doesn't affect pin filtering.
          const hasStoredVariants = Array.isArray(item.meta_ad_variants) && item.meta_ad_variants.length > 0;
          const platformForRender = hasStoredVariants
            ? (item.ad_platform as AdPlatform) || 'facebook_feed'
            : ((currentView as AdPlatform | null) || (item.ad_platform as AdPlatform) || 'facebook_feed');

          // Count unresolved pin comments per variant for the sidebar badge.
          const commentCountsByVariantId = hasStoredVariants
            ? pinComments.reduce<Record<string, number>>((acc, c) => {
                const parsedView = parseMetaAdVariantView(getCommentView(c.annotation_data));
                if (parsedView?.id) acc[parsedView.id] = (acc[parsedView.id] ?? 0) + 1;
                return acc;
              }, {})
            : undefined;

          return (
            <div>
              <AdMockupPreview
                creativeUrl={item.ad_creative_url!}
                ctaText={item.ad_cta || 'Learn More'}
                platform={platformForRender}
                pageName={displayBrandName}
                showPlatformToggle
                accentColor={accentColor}
                onPlatformChange={(p) => {
                  // Only stamp the view from platform changes for legacy ads;
                  // variant ads keep their view = variant-<id>.
                  if (!hasStoredVariants) onViewChange?.(p);
                }}
                variants={hasStoredVariants ? variants : undefined}
                activeVariantId={hasStoredVariants ? activeVariantId : undefined}
                onVariantChange={hasStoredVariants ? (id) => onViewChange?.(metaAdVariantView(id)) : undefined}
                commentCountsByVariantId={commentCountsByVariantId}
                headline={hasStoredVariants ? undefined : (item.ad_headline || '')}
                primaryText={hasStoredVariants ? undefined : (item.ad_copy || '')}
              />
            </div>
          );
        })()}
        {/* Image (non-ad) — wrapped in a subtle card container with title caption.
            crossOrigin="anonymous" lets html2canvas read the pixels for pin screenshots. */}
        {!isAd && imageUrl && (
          <div className="bg-surface rounded-2xl shadow-card-soft overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-edge">
              <div className="w-6 h-6 rounded-md bg-white shadow-card-soft flex items-center justify-center">
                <ImageIcon size={12} className="text-primary" />
              </div>
              <span className="text-caption font-medium text-ink truncate">{item.title || 'Image'}</span>
              <span className="text-detail text-faint ml-auto shrink-0">Image</span>
            </div>
            <div className="flex items-center justify-center bg-white p-2">
              <img
                src={imageUrl}
                alt={item.title}
                crossOrigin="anonymous"
                className="max-w-full max-h-[calc(100dvh-200px)] object-contain select-none"
                draggable={false}
              />
            </div>
          </div>
        )}
        {/* Pin overlay */}
        <PinOverlay
          pinComments={visiblePins}
          pendingPin={pendingPin}
          onPinClick={onPinClick}
        />
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement | null>}
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
    <div className="max-w-3xl mx-auto bg-surface rounded-2xl shadow-card-soft flex flex-col items-center justify-center py-20">
      <ImageIcon size={32} className="text-faint mb-3" />
      <p className="text-caption font-medium text-ink">No preview available</p>
      <p className="text-detail text-muted mt-1">{emptyText}</p>
    </div>
  );
}

