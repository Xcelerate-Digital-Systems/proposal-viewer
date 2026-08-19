'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, Heart, Bookmark, Send, Globe,
  ChevronRight, ChevronLeft, MessageSquare, Plus, Copy, Check, LayoutGrid, AlertTriangle,
} from 'lucide-react';
import type { MetaAdVariant, AdCreative, AdCreativeFormat, CarouselCard } from '@/lib/types/feedback';
import type { VariantDecision, VariantDecisionSummary } from '@/hooks/useVariantDecisions';

export type AdPlatform = 'facebook_feed' | 'instagram_feed' | 'instagram_story';

interface AdMockupPreviewProps {
  /** The ad creative image URL */
  creativeUrl: string;
  /** Headline text — used when `variants` is not provided. */
  headline?: string;
  /** Primary text / body copy — used when `variants` is not provided. */
  primaryText?: string;
  /** CTA button text */
  ctaText: string;
  /** Which platform frame to show */
  platform: AdPlatform;
  /** Advertiser / page name */
  pageName?: string;
  /** Page profile image URL (optional — shows initial if not provided) */
  pageImageUrl?: string;
  /** Destination URL display text (e.g. "example.com") */
  displayUrl?: string;
  /** Whether to show platform toggle tabs */
  showPlatformToggle?: boolean;
  /** Callback when platform changes */
  onPlatformChange?: (platform: AdPlatform) => void;
  /** Brand accent color for theming (used in dark mode contexts) */
  accentColor?: string;
  /** Dark mode (for client viewer) */
  dark?: boolean;
  /** When supplied, replaces the single headline/primaryText with a variant
   *  sidebar (rendered only when there are 2+ variants). The active
   *  variant's text feeds the mockup; clicking another variant calls
   *  `onVariantChange` so pin/highlight creation can scope to that variant. */
  variants?: MetaAdVariant[];
  activeVariantId?: string | null;
  onVariantChange?: (variantId: string) => void;
  /** Unresolved comment count keyed by variant id, used to badge rows that
   *  already have feedback. */
  commentCountsByVariantId?: Record<string, number>;
  /** Whether comparison mode is active. */
  compareMode?: boolean;
  /** Toggle comparison mode on/off. Only shown when >= 2 variants. */
  onCompareModeChange?: (active: boolean) => void;
  /** Current reviewer's decision per variant (keyed by variant id). */
  myVariantDecisions?: Record<string, VariantDecision | null>;
  /** Decision summaries per variant (keyed by variant id). */
  variantDecisionSummaries?: Record<string, VariantDecisionSummary>;
  /** Callback when reviewer clicks a variant decision icon. */
  onVariantDecision?: (variantId: string, decision: VariantDecision) => void;
  /** Multi-format creatives (square + vertical + carousel). When present, shows a
   *  format picker and switches the creative image + aspect ratio. */
  formatCreatives?: AdCreative[];
  /** Currently active format. Defaults to 'square'. */
  activeFormat?: AdCreativeFormat;
  /** Callback when format changes. */
  onFormatChange?: (format: AdCreativeFormat) => void;
  /** Carousel cards for carousel format. */
  carouselCards?: CarouselCard[];
}

export default function AdMockupPreview({
  creativeUrl,
  headline = '',
  primaryText = '',
  ctaText,
  platform,
  pageName = 'Your Brand',
  pageImageUrl,
  displayUrl,
  showPlatformToggle = false,
  onPlatformChange,
  accentColor,
  dark = false,
  variants,
  activeVariantId,
  onVariantChange,
  commentCountsByVariantId,
  compareMode,
  onCompareModeChange,
  myVariantDecisions,
  variantDecisionSummaries,
  onVariantDecision,
  formatCreatives,
  activeFormat: activeFormatProp,
  onFormatChange,
  carouselCards,
}: AdMockupPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<AdPlatform>(platform);
  useEffect(() => { setActivePlatform(platform); }, [platform]);
  const [internalFormat, setInternalFormat] = useState<AdCreativeFormat>(activeFormatProp ?? 'square');
  useEffect(() => { if (activeFormatProp) setInternalFormat(activeFormatProp); }, [activeFormatProp]);

  const handlePlatformChange = (p: AdPlatform) => {
    setActivePlatform(p);
    onPlatformChange?.(p);
  };

  const handleFormatChange = (f: AdCreativeFormat) => {
    setInternalFormat(f);
    onFormatChange?.(f);
  };

  const currentPlatform = showPlatformToggle ? activePlatform : platform;
  const showFormatPicker = formatCreatives && formatCreatives.length >= 2;
  const currentFormat = internalFormat;
  const effectiveCreativeUrl = (() => {
    if (!formatCreatives || formatCreatives.length === 0) return creativeUrl;
    const match = formatCreatives.find((c) => c.format === currentFormat);
    return match?.url ?? creativeUrl;
  })();
  const creativeAspect = currentFormat === 'vertical' ? 'aspect-[9/16]' : 'aspect-square';
  const isCarousel = currentFormat === 'carousel' && carouselCards && carouselCards.length >= 2;

  // Pick the active variant
  const variantList = variants && variants.length > 0
    ? variants
    : [{ id: 'inline', headline, primary_text: primaryText }];
  const active = variantList.find((v) => v.id === activeVariantId) ?? variantList[0];
  const effectiveHeadline = active.headline;
  const effectivePrimaryText = active.primary_text;
  const showSidebar = variantList.length >= 2;

  const brand = accentColor || '#017C87';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[500px] mx-auto">
      {showSidebar && (
        <div className="flex flex-col items-center gap-2 w-full mb-4">
          <div className="flex items-center gap-2">
            <p
              className="text-xs font-medium tracking-wide"
              style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#6B6B6B' }}
            >
              {compareMode ? 'Comparing all variants' : 'Switch between your different copy variations here'}
            </p>
            {onCompareModeChange && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCompareModeChange(!compareMode); }}
                className="inline-flex items-center gap-1 text-2xs font-medium rounded-full px-2.5 py-1 transition-colors"
                style={{
                  backgroundColor: compareMode ? brand : (dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                  color: compareMode ? '#FFFFFF' : (dark ? 'rgba(255,255,255,0.7)' : '#374151'),
                }}
              >
                <LayoutGrid size={11} />
                {compareMode ? 'Single' : 'Compare'}
              </button>
            )}
          </div>
          {!compareMode && (
            <VariantPillRow
              variants={variantList}
              activeId={active.id}
              onSelect={onVariantChange}
              commentCounts={commentCountsByVariantId}
              brand={brand}
              dark={dark}
              myDecisions={myVariantDecisions}
              decisionSummaries={variantDecisionSummaries}
              onDecision={onVariantDecision}
            />
          )}
        </div>
      )}

      {/* Platform + Format toggles */}
      <div className="flex items-center gap-2">
        {showPlatformToggle && (
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{
              borderColor: dark ? '#ffffff18' : '#e5e7eb',
              backgroundColor: dark ? '#ffffff08' : '#f9fafb',
            }}
          >
            {([
              { key: 'facebook_feed' as AdPlatform, label: 'Facebook' },
              { key: 'instagram_feed' as AdPlatform, label: 'Instagram' },
            ]).map((p) => (
              <button
                key={p.key}
                onClick={(e) => { e.stopPropagation(); handlePlatformChange(p.key); }}
                className="px-4 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: currentPlatform === p.key ? brand : 'transparent',
                  color: currentPlatform === p.key
                    ? '#ffffff'
                    : (dark ? '#ffffff88' : '#6b7280'),
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {showFormatPicker && (
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{
              borderColor: dark ? '#ffffff18' : '#e5e7eb',
              backgroundColor: dark ? '#ffffff08' : '#f9fafb',
            }}
          >
            {formatCreatives!.map((fc) => {
              const label = fc.format === 'square' ? '1:1' : fc.format === 'vertical' ? '9:16' : 'Carousel';
              return (
                <button
                  key={fc.format}
                  onClick={(e) => { e.stopPropagation(); handleFormatChange(fc.format); }}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: currentFormat === fc.format ? brand : 'transparent',
                    color: currentFormat === fc.format
                      ? '#ffffff'
                      : (dark ? '#ffffff88' : '#6b7280'),
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isCarousel ? (
        currentPlatform === 'facebook_feed' ? (
          <FacebookCarouselAd
            cards={carouselCards!}
            primaryText={effectivePrimaryText}
            ctaText={ctaText}
            pageName={pageName}
            pageImageUrl={pageImageUrl}
            dark={dark}
          />
        ) : (
          <InstagramCarouselAd
            cards={carouselCards!}
            primaryText={effectivePrimaryText}
            headline={effectiveHeadline}
            ctaText={ctaText}
            pageName={pageName}
            pageImageUrl={pageImageUrl}
            dark={dark}
          />
        )
      ) : (
        <>
          {currentPlatform === 'facebook_feed' && (
            <FacebookFeedAd
              creativeUrl={effectiveCreativeUrl}
              headline={effectiveHeadline}
              primaryText={effectivePrimaryText}
              ctaText={ctaText}
              pageName={pageName}
              pageImageUrl={pageImageUrl}
              displayUrl={displayUrl}
              dark={dark}
              creativeAspect={creativeAspect}
            />
          )}
          {currentPlatform === 'instagram_feed' && (
            <InstagramFeedAd
              creativeUrl={effectiveCreativeUrl}
              headline={effectiveHeadline}
              primaryText={effectivePrimaryText}
              ctaText={ctaText}
              pageName={pageName}
              pageImageUrl={pageImageUrl}
              dark={dark}
              creativeAspect={creativeAspect}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Variant pill row                                                   */
/* ================================================================== */

function VariantPillRow({
  variants, activeId, onSelect, commentCounts, brand, dark,
  myDecisions, decisionSummaries, onDecision,
}: {
  variants: MetaAdVariant[];
  activeId: string;
  onSelect?: (id: string) => void;
  commentCounts?: Record<string, number>;
  brand: string;
  dark?: boolean;
  myDecisions?: Record<string, VariantDecision | null>;
  decisionSummaries?: Record<string, VariantDecisionSummary>;
  onDecision?: (variantId: string, decision: VariantDecision) => void;
}) {
  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-1.5">
      {variants.map((v, i) => {
        const active = v.id === activeId;
        const commentCount = commentCounts?.[v.id] ?? 0;
        const variantLabel = v.label?.trim() || `Variant ${i + 1}`;
        const inactiveBg = dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6';
        const inactiveText = dark ? 'rgba(255,255,255,0.7)' : '#374151';
        const inactiveHoverBg = dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
        return (
          <button
            key={v.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect?.(v.id); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full pl-1 pr-3 py-1 transition-colors"
            style={{
              backgroundColor: active ? brand : inactiveBg,
              color: active ? '#FFFFFF' : inactiveText,
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.backgroundColor = inactiveHoverBg;
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.backgroundColor = inactiveBg;
            }}
          >
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-semibold shrink-0"
              style={{
                backgroundColor: active ? 'rgba(255,255,255,0.22)' : (dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF'),
                color: active ? '#FFFFFF' : (dark ? 'rgba(255,255,255,0.6)' : '#6B7280'),
              }}
            >
              {i + 1}
            </span>
            <span className="max-w-[180px] truncate">{variantLabel}</span>
            {commentCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-1.5 h-4 rounded-full text-2xs font-semibold shrink-0"
                style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.22)' : '#FFF1D6',
                  color: active ? '#FFFFFF' : '#92500F',
                }}
              >
                <MessageSquare size={9} />
                {commentCount}
              </span>
            )}
            {(() => {
              const myDec = myDecisions?.[v.id];
              const summary = decisionSummaries?.[v.id];
              const showApproved = myDec === 'approved';
              const showChanges = myDec === 'changes_requested';
              return (
                <>
                  {onDecision && (
                    <span className="inline-flex items-center gap-0.5 shrink-0 ml-0.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDecision(v.id, 'approved'); }}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors"
                        style={{
                          backgroundColor: showApproved ? '#10b981' : (active ? 'rgba(255,255,255,0.15)' : (dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB')),
                          color: showApproved ? '#FFFFFF' : (active ? 'rgba(255,255,255,0.6)' : (dark ? 'rgba(255,255,255,0.4)' : '#9CA3AF')),
                        }}
                        title={showApproved ? 'Clear approval' : 'Approve variant'}
                      >
                        <Check size={9} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDecision(v.id, 'changes_requested'); }}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors"
                        style={{
                          backgroundColor: showChanges ? '#f59e0b' : (active ? 'rgba(255,255,255,0.15)' : (dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB')),
                          color: showChanges ? '#FFFFFF' : (active ? 'rgba(255,255,255,0.6)' : (dark ? 'rgba(255,255,255,0.4)' : '#9CA3AF')),
                        }}
                        title={showChanges ? 'Clear changes requested' : 'Request changes'}
                      >
                        <AlertTriangle size={9} />
                      </button>
                    </span>
                  )}
                  {!onDecision && summary && summary.total > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1 h-4 rounded-full text-2xs font-semibold shrink-0"
                      style={{
                        backgroundColor: summary.approved === summary.total ? '#D1FAE5' : (summary.changes_requested > 0 ? '#FEF3C7' : '#D1FAE5'),
                        color: summary.approved === summary.total ? '#065F46' : (summary.changes_requested > 0 ? '#92400E' : '#065F46'),
                      }}
                    >
                      {summary.approved === summary.total ? <Check size={8} /> : <AlertTriangle size={8} />}
                      {summary.approved}/{summary.total}
                    </span>
                  )}
                </>
              );
            })()}
          </button>
        );
      })}
    </div>
  );
}

/* Inline placeholder for the editor */
export function AdMockupPreviewAddVariantButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:text-teal-hover bg-teal/10 hover:bg-teal/15 rounded-full px-3 py-1.5 transition-colors"
    >
      <Plus size={12} />
      Add variant
    </button>
  );
}

/* ================================================================== */
/*  Facebook Feed Ad                                                   */
/* ================================================================== */

function FacebookFeedAd({
  creativeUrl, headline, primaryText, ctaText, pageName, pageImageUrl, displayUrl, dark, creativeAspect = 'aspect-square',
}: {
  creativeUrl: string; headline: string; primaryText: string; ctaText: string;
  pageName: string; pageImageUrl?: string; displayUrl?: string; dark?: boolean; creativeAspect?: string;
}) {
  const bg = dark ? '#242526' : '#ffffff';
  const text = dark ? '#e4e6eb' : '#050505';
  const textSecondary = dark ? '#b0b3b8' : '#65676b';
  const borderColor = dark ? '#3e4042' : '#e4e6e9';

  return (
    <div className="w-full max-w-[500px] rounded-lg overflow-hidden shadow-sm"
      style={{ backgroundColor: bg, border: `1px solid ${borderColor}` }}>

      {/* Page header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <PageAvatar name={pageName} imageUrl={pageImageUrl} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-caption font-semibold" style={{ color: text }}>{pageName}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-detail" style={{ color: textSecondary }}>Sponsored</span>
            <span className="text-detail" style={{ color: textSecondary }}>·</span>
            <Globe size={10} style={{ color: textSecondary }} />
          </div>
        </div>
        <button className="p-2 rounded-full" style={{ color: textSecondary }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Primary text */}
      {primaryText && (
        <div className="px-4 pb-2.5 flex items-start gap-1.5 group/copy">
          <p className="flex-1 min-w-0 text-[15px] leading-[20px] whitespace-pre-wrap" style={{ color: text }}>
            {primaryText}
          </p>
          <span className="opacity-0 group-hover/copy:opacity-100 transition-opacity mt-0.5">
            <CopyTextButton text={primaryText} dark={dark} />
          </span>
        </div>
      )}

      <div data-creative className={`w-full ${creativeAspect} bg-surface overflow-hidden`}>
        <img
          src={creativeUrl}
          alt="Ad creative"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Link preview bar + CTA */}
      <div className="flex items-center justify-between px-4 py-3 group/headline"
        style={{ backgroundColor: dark ? '#3a3b3c' : '#f0f2f5' }}>
        <div className="flex-1 min-w-0 mr-3">
          {displayUrl && (
            <p className="text-xs uppercase tracking-wide truncate" style={{ color: textSecondary }}>
              {displayUrl}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <p className="flex-1 min-w-0 text-[15px] font-semibold leading-tight truncate" style={{ color: text }}>
              {headline}
            </p>
            <span className="opacity-0 group-hover/headline:opacity-100 transition-opacity">
              <CopyTextButton text={headline} dark={dark} />
            </span>
          </div>
        </div>
        <button
          className="shrink-0 px-4 py-2 rounded-lg text-caption font-semibold"
          style={{ backgroundColor: dark ? '#4e4f50' : '#e4e6e9', color: text }}
        >
          {ctaText || 'Learn More'}
        </button>
      </div>

      {/* Engagement bar */}
      <div className="px-4 py-1 border-t" style={{ borderColor }}>
        <div className="flex items-center justify-between py-1">
          {[
            { icon: ThumbsUp, label: 'Like' },
            { icon: MessageCircle, label: 'Comment' },
            { icon: Share2, label: 'Share' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-caption font-semibold transition-colors"
              style={{ color: textSecondary }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Facebook Carousel Ad                                               */
/* ================================================================== */

function FacebookCarouselAd({
  cards, primaryText, ctaText, pageName, pageImageUrl, dark,
}: {
  cards: CarouselCard[]; primaryText: string; ctaText: string;
  pageName: string; pageImageUrl?: string; dark?: boolean;
}) {
  const bg = dark ? '#242526' : '#ffffff';
  const text = dark ? '#e4e6eb' : '#050505';
  const textSecondary = dark ? '#b0b3b8' : '#65676b';
  const borderColor = dark ? '#3e4042' : '#e4e6e9';
  const cardBg = dark ? '#3a3b3c' : '#f0f2f5';

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const scrollTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, cards.length - 1));
    setActiveIdx(clamped);
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 0;
    el.scrollTo({ left: clamped * cardWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !el.firstElementChild) return;
    const cardWidth = el.firstElementChild.getBoundingClientRect().width;
    if (cardWidth === 0) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(idx);
  };

  return (
    <div className="w-full max-w-[500px] rounded-lg overflow-hidden shadow-sm"
      style={{ backgroundColor: bg, border: `1px solid ${borderColor}` }}>

      {/* Page header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <PageAvatar name={pageName} imageUrl={pageImageUrl} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-caption font-semibold" style={{ color: text }}>{pageName}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-detail" style={{ color: textSecondary }}>Sponsored</span>
            <span className="text-detail" style={{ color: textSecondary }}>·</span>
            <Globe size={10} style={{ color: textSecondary }} />
          </div>
        </div>
        <button className="p-2 rounded-full" style={{ color: textSecondary }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Primary text */}
      {primaryText && (
        <div className="px-4 pb-2.5 flex items-start gap-1.5 group/copy">
          <p className="flex-1 min-w-0 text-[15px] leading-[20px] whitespace-pre-wrap" style={{ color: text }}>
            {primaryText}
          </p>
          <span className="opacity-0 group-hover/copy:opacity-100 transition-opacity mt-0.5">
            <CopyTextButton text={primaryText} dark={dark} />
          </span>
        </div>
      )}

      {/* Carousel cards */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card, i) => (
            <div key={card.id} className="w-full shrink-0 snap-start">
              <div data-creative className="w-full aspect-square bg-surface overflow-hidden">
                <img
                  src={card.image_url}
                  alt={card.headline || `Card ${i + 1}`}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: cardBg }}>
                <div className="flex-1 min-w-0 mr-3">
                  {card.headline && (
                    <p className="text-[15px] font-semibold leading-tight truncate" style={{ color: text }}>
                      {card.headline}
                    </p>
                  )}
                  {card.description && (
                    <p className="text-xs leading-tight truncate mt-0.5" style={{ color: textSecondary }}>
                      {card.description}
                    </p>
                  )}
                  {card.destination_url && (
                    <p className="text-xs truncate mt-0.5" style={{ color: textSecondary }}>
                      {card.destination_url.replace(/^https?:\/\//, '').split('/')[0]}
                    </p>
                  )}
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: dark ? '#4e4f50' : '#e4e6e9', color: text }}
                >
                  {ctaText || 'Learn More'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        {activeIdx > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(activeIdx - 1); }}
            className="absolute left-2 top-[calc(50%-28px)] -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
        )}
        {activeIdx < cards.length - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(activeIdx + 1); }}
            className="absolute right-2 top-[calc(50%-28px)] -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronRight size={18} className="text-gray-700" />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1 py-2">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(i); }}
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{ backgroundColor: i === activeIdx ? (dark ? '#e4e6eb' : '#050505') : (dark ? '#3e4042' : '#d1d5db') }}
          />
        ))}
      </div>

      {/* Engagement bar */}
      <div className="px-4 py-1 border-t" style={{ borderColor }}>
        <div className="flex items-center justify-between py-1">
          {[
            { icon: ThumbsUp, label: 'Like' },
            { icon: MessageCircle, label: 'Comment' },
            { icon: Share2, label: 'Share' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-caption font-semibold transition-colors"
              style={{ color: textSecondary }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Instagram Feed Ad                                                  */
/* ================================================================== */

function InstagramFeedAd({
  creativeUrl, headline, primaryText, ctaText, pageName, pageImageUrl, dark, creativeAspect = 'aspect-square',
}: {
  creativeUrl: string; headline: string; primaryText: string; ctaText: string;
  pageName: string; pageImageUrl?: string; dark?: boolean; creativeAspect?: string;
}) {
  const bg = dark ? '#000000' : '#ffffff';
  const text = dark ? '#f5f5f5' : '#262626';
  const textSecondary = dark ? '#a8a8a8' : '#8e8e8e';
  const borderColor = dark ? '#363636' : '#dbdbdb';

  return (
    <div className="w-full max-w-[468px] overflow-hidden"
      style={{ backgroundColor: bg, border: `1px solid ${borderColor}`, borderRadius: 3 }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            padding: 2,
          }}
        >
          <div className="w-full h-full rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
            <div className="w-full h-full rounded-full overflow-hidden" style={{ margin: 1 }}>
              <PageAvatar name={pageName} imageUrl={pageImageUrl} size={26} />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-caption font-semibold" style={{ color: text }}>{pageName.toLowerCase().replace(/\s+/g, '')}</span>
          </div>
          <span className="text-detail" style={{ color: textSecondary }}>Sponsored</span>
        </div>
        <button style={{ color: text }}><MoreHorizontal size={20} /></button>
      </div>

      <div data-creative className={`w-full ${creativeAspect} overflow-hidden`}>
        <img
          src={creativeUrl}
          alt="Ad creative"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
        />
      </div>

      {/* CTA banner */}
      {ctaText && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor, backgroundColor: dark ? '#1a1a1a' : '#fafafa' }}>
          <span className="text-caption font-semibold" style={{ color: text }}>
            {ctaText}
          </span>
          <ChevronRight size={18} style={{ color: text }} />
        </div>
      )}

      {/* Action icons */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-4">
          <Heart size={24} style={{ color: text }} />
          <MessageCircle size={24} style={{ color: text }} />
          <Send size={24} style={{ color: text }} />
        </div>
        <Bookmark size={24} style={{ color: text }} />
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        {headline && (
          <div className="flex items-start gap-1.5 group/ighl">
            <p className="flex-1 min-w-0 text-caption leading-[18px]" style={{ color: text }}>
              <span className="font-semibold">{pageName.toLowerCase().replace(/\s+/g, '')}</span>{' '}
              {headline}
            </p>
            <span className="opacity-0 group-hover/ighl:opacity-100 transition-opacity mt-0.5">
              <CopyTextButton text={headline} dark={dark} />
            </span>
          </div>
        )}
        {primaryText && primaryText !== headline && (
          <div className="flex items-start gap-1.5 group/igpt mt-0.5">
            <p className="flex-1 min-w-0 text-caption leading-[18px] whitespace-pre-wrap" style={{ color: text }}>
              {primaryText}
            </p>
            <span className="opacity-0 group-hover/igpt:opacity-100 transition-opacity mt-0.5">
              <CopyTextButton text={primaryText} dark={dark} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Instagram Carousel Ad                                              */
/* ================================================================== */

function InstagramCarouselAd({
  cards, primaryText, headline, ctaText, pageName, pageImageUrl, dark,
}: {
  cards: CarouselCard[]; primaryText: string; headline: string; ctaText: string;
  pageName: string; pageImageUrl?: string; dark?: boolean;
}) {
  const bg = dark ? '#000000' : '#ffffff';
  const text = dark ? '#f5f5f5' : '#262626';
  const textSecondary = dark ? '#a8a8a8' : '#8e8e8e';
  const borderColor = dark ? '#363636' : '#dbdbdb';

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const scrollTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, cards.length - 1));
    setActiveIdx(clamped);
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 0;
    el.scrollTo({ left: clamped * cardWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !el.firstElementChild) return;
    const cardWidth = el.firstElementChild.getBoundingClientRect().width;
    if (cardWidth === 0) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(idx);
  };

  return (
    <div className="w-full max-w-[468px] overflow-hidden"
      style={{ backgroundColor: bg, border: `1px solid ${borderColor}`, borderRadius: 3 }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            padding: 2,
          }}
        >
          <div className="w-full h-full rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
            <div className="w-full h-full rounded-full overflow-hidden" style={{ margin: 1 }}>
              <PageAvatar name={pageName} imageUrl={pageImageUrl} size={26} />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-caption font-semibold" style={{ color: text }}>{pageName.toLowerCase().replace(/\s+/g, '')}</span>
          </div>
          <span className="text-detail" style={{ color: textSecondary }}>Sponsored</span>
        </div>
        <button style={{ color: text }}><MoreHorizontal size={20} /></button>
      </div>

      {/* Carousel cards */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card, i) => (
            <div key={card.id} className="w-full shrink-0 snap-start">
              <div data-creative className="w-full aspect-square overflow-hidden">
                <img
                  src={card.image_url}
                  alt={card.headline || `Card ${i + 1}`}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        {activeIdx > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(activeIdx - 1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronLeft size={16} className="text-gray-700" />
          </button>
        )}
        {activeIdx < cards.length - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(activeIdx + 1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronRight size={16} className="text-gray-700" />
          </button>
        )}
      </div>

      {/* CTA banner with card headline */}
      {ctaText && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor, backgroundColor: dark ? '#1a1a1a' : '#fafafa' }}>
          <div className="flex-1 min-w-0 mr-2">
            {cards[activeIdx]?.headline && (
              <p className="text-caption font-semibold truncate" style={{ color: text }}>
                {cards[activeIdx].headline}
              </p>
            )}
            {cards[activeIdx]?.description && (
              <p className="text-xs truncate" style={{ color: textSecondary }}>
                {cards[activeIdx].description}
              </p>
            )}
          </div>
          <span className="text-caption font-semibold shrink-0" style={{ color: text }}>
            {ctaText}
          </span>
          <ChevronRight size={18} style={{ color: text }} className="shrink-0 ml-1" />
        </div>
      )}

      {/* Dot indicators + Action icons */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-4">
          <Heart size={24} style={{ color: text }} />
          <MessageCircle size={24} style={{ color: text }} />
          <Send size={24} style={{ color: text }} />
        </div>
        <div className="flex items-center gap-1">
          {cards.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i === activeIdx ? '#3897f0' : (dark ? '#363636' : '#d1d5db') }}
            />
          ))}
        </div>
        <Bookmark size={24} style={{ color: text }} />
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        {headline && (
          <div className="flex items-start gap-1.5 group/ighl">
            <p className="flex-1 min-w-0 text-caption leading-[18px]" style={{ color: text }}>
              <span className="font-semibold">{pageName.toLowerCase().replace(/\s+/g, '')}</span>{' '}
              {headline}
            </p>
            <span className="opacity-0 group-hover/ighl:opacity-100 transition-opacity mt-0.5">
              <CopyTextButton text={headline} dark={dark} />
            </span>
          </div>
        )}
        {primaryText && primaryText !== headline && (
          <div className="flex items-start gap-1.5 group/igpt mt-0.5">
            <p className="flex-1 min-w-0 text-caption leading-[18px] whitespace-pre-wrap" style={{ color: text }}>
              {primaryText}
            </p>
            <span className="opacity-0 group-hover/igpt:opacity-100 transition-opacity mt-0.5">
              <CopyTextButton text={primaryText} dark={dark} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Shared: Copy Text Button                                           */
/* ================================================================== */

function CopyTextButton({ text, dark }: { text: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center shrink-0 rounded p-1 transition-colors"
      style={{
        color: copied ? '#10b981' : (dark ? '#b0b3b8' : '#9ca3af'),
        backgroundColor: copied ? (dark ? '#10b98118' : '#10b98112') : 'transparent',
      }}
      title={copied ? 'Copied!' : 'Copy text'}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ================================================================== */
/*  Shared: Page Avatar                                                */
/* ================================================================== */

function PageAvatar({ name, imageUrl, size = 40 }: { name: string; imageUrl?: string; size?: number }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        crossOrigin="anonymous"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
