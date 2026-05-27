'use client';

import { useState, useEffect } from 'react';
import {
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, Heart, Bookmark, Send, Globe,
  ChevronRight, MessageSquare, Plus,
} from 'lucide-react';
import type { MetaAdVariant } from '@/lib/types/feedback';

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
}: AdMockupPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<AdPlatform>(platform);
  useEffect(() => { setActivePlatform(platform); }, [platform]);

  const handlePlatformChange = (p: AdPlatform) => {
    setActivePlatform(p);
    onPlatformChange?.(p);
  };

  const currentPlatform = showPlatformToggle ? activePlatform : platform;

  // Pick the active variant. When no variants are passed, synthesise a
  // single-row list from the legacy props so the downstream mockup code
  // only ever reads `effectiveHeadline` / `effectivePrimaryText`.
  const variantList = variants && variants.length > 0
    ? variants
    : [{ id: 'inline', headline, primary_text: primaryText }];
  const active = variantList.find((v) => v.id === activeVariantId) ?? variantList[0];
  const effectiveHeadline = active.headline;
  const effectivePrimaryText = active.primary_text;
  const showSidebar = variantList.length >= 2;

  // Brand colour for active pills / toggles. Per-project branding is
  // threaded in via `accentColor`; everything else falls back to the
  // AgencyViz teal so unbranded projects still look on-brand.
  const brand = accentColor || '#017C87';

  return (
    // max-w-[500px] matches the FB feed mockup card (Instagram is 468px so it
    // stays comfortably inside). Pinning the whole column to one width means
    // the variant pill row can't reflow when the comments panel opens — and
    // therefore the container's total height stays constant between when we
    // measure the click position (%) and when the pin is rendered. Without
    // this, opening the panel grew the variant row, pushed the creative down,
    // and the cached pct% no longer pointed at the image (pin landed in the
    // copy above it — that's what the reviewer saw as "scrolling to the copy").
    <div className="flex flex-col items-center gap-3 w-full max-w-[500px] mx-auto">
      {showSidebar && (
        <div className="flex flex-col items-center gap-2 w-full mb-4">
          <p
            className="text-xs font-medium tracking-wide"
            style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#6B6B6B' }}
          >
            Switch between your different copy variations here
          </p>
          <VariantPillRow
            variants={variantList}
            activeId={active.id}
            onSelect={onVariantChange}
            commentCounts={commentCountsByVariantId}
            brand={brand}
            dark={dark}
          />
        </div>
      )}

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

      {currentPlatform === 'facebook_feed' && (
        <FacebookFeedAd
          creativeUrl={creativeUrl}
          headline={effectiveHeadline}
          primaryText={effectivePrimaryText}
          ctaText={ctaText}
          pageName={pageName}
          pageImageUrl={pageImageUrl}
          displayUrl={displayUrl}
          dark={dark}
        />
      )}
      {currentPlatform === 'instagram_feed' && (
        <InstagramFeedAd
          creativeUrl={creativeUrl}
          headline={effectiveHeadline}
          primaryText={effectivePrimaryText}
          ctaText={ctaText}
          pageName={pageName}
          pageImageUrl={pageImageUrl}
          dark={dark}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Variant pill row                                                   */
/* ================================================================== */

/** Horizontal row of variant pills shown above the platform toggle. Active
 *  pill picks up the project's brand colour (per-project accent or
 *  AgencyViz teal); inactive pills are muted. Wraps onto two lines once
 *  there are too many variants to fit. */
function VariantPillRow({
  variants, activeId, onSelect, commentCounts, brand, dark,
}: {
  variants: MetaAdVariant[];
  activeId: string;
  onSelect?: (id: string) => void;
  commentCounts?: Record<string, number>;
  brand: string;
  dark?: boolean;
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
          </button>
        );
      })}
    </div>
  );
}

/* Inline placeholder for the editor — used to render an "Add variant" link
   in the editor preview only (not in the read-only viewer). Kept here so
   the sidebar visual styling stays consistent. */
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
  creativeUrl, headline, primaryText, ctaText, pageName, pageImageUrl, displayUrl, dark,
}: {
  creativeUrl: string; headline: string; primaryText: string; ctaText: string;
  pageName: string; pageImageUrl?: string; displayUrl?: string; dark?: boolean;
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
            <span className="text-[13px] font-semibold" style={{ color: text }}>{pageName}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: textSecondary }}>Sponsored</span>
            <span className="text-[11px]" style={{ color: textSecondary }}>·</span>
            <Globe size={10} style={{ color: textSecondary }} />
          </div>
        </div>
        <button className="p-2 rounded-full" style={{ color: textSecondary }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Primary text */}
      {primaryText && (
        <div className="px-4 pb-2.5">
          <p className="text-[15px] leading-[20px] whitespace-pre-wrap" style={{ color: text }}>
            {primaryText}
          </p>
        </div>
      )}

      {/* Creative image — data-creative tags the click target so a pin
          placed here gets stamped with the shared `creative` view instead
          of the active variant; that way creative feedback is visible on
          every variant (the image doesn't change between them). */}
      <div data-creative className="w-full aspect-square bg-gray-100 overflow-hidden">
        <img
          src={creativeUrl}
          alt="Ad creative"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Link preview bar + CTA */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: dark ? '#3a3b3c' : '#f0f2f5' }}>
        <div className="flex-1 min-w-0 mr-3">
          {displayUrl && (
            <p className="text-xs uppercase tracking-wide truncate" style={{ color: textSecondary }}>
              {displayUrl}
            </p>
          )}
          <p className="text-[15px] font-semibold leading-tight truncate" style={{ color: text }}>
            {headline}
          </p>
        </div>
        <button
          className="shrink-0 px-4 py-2 rounded-md text-[13px] font-semibold"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
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
  creativeUrl, headline, primaryText, ctaText, pageName, pageImageUrl, dark,
}: {
  creativeUrl: string; headline: string; primaryText: string; ctaText: string;
  pageName: string; pageImageUrl?: string; dark?: boolean;
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
            <span className="text-[13px] font-semibold" style={{ color: text }}>{pageName.toLowerCase().replace(/\s+/g, '')}</span>
          </div>
          <span className="text-[11px]" style={{ color: textSecondary }}>Sponsored</span>
        </div>
        <button style={{ color: text }}><MoreHorizontal size={20} /></button>
      </div>

      {/* Creative image — see FacebookFeedAd for the data-creative rationale. */}
      <div data-creative className="w-full aspect-square overflow-hidden">
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
          <span className="text-[13px] font-semibold" style={{ color: text }}>
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
          <p className="text-[13px] leading-[18px]" style={{ color: text }}>
            <span className="font-semibold">{pageName.toLowerCase().replace(/\s+/g, '')}</span>{' '}
            {headline}
          </p>
        )}
        {primaryText && primaryText !== headline && (
          <p className="text-[13px] leading-[18px] mt-0.5 whitespace-pre-wrap" style={{ color: text }}>
            {primaryText}
          </p>
        )}
      </div>
    </div>
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
