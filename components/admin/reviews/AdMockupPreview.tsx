// components/admin/reviews/AdMockupPreview.tsx
'use client';

import { useState } from 'react';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Heart, Bookmark, Send, Globe, ChevronRight } from 'lucide-react';

export type AdPlatform = 'facebook_feed' | 'instagram_feed' | 'instagram_story';

interface AdMockupPreviewProps {
  /** The ad creative image URL */
  creativeUrl: string;
  /** Headline text (shown below image on Facebook, or as first comment on Instagram) */
  headline: string;
  /** Primary text / body copy (shown above image) */
  primaryText: string;
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
}

export default function AdMockupPreview({
  creativeUrl,
  headline,
  primaryText,
  ctaText,
  platform,
  pageName = 'Your Brand',
  pageImageUrl,
  displayUrl,
  showPlatformToggle = false,
  onPlatformChange,
  accentColor,
  dark = false,
}: AdMockupPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<AdPlatform>(platform);

  const handlePlatformChange = (p: AdPlatform) => {
    setActivePlatform(p);
    onPlatformChange?.(p);
  };

  const currentPlatform = showPlatformToggle ? activePlatform : platform;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Platform toggle */}
      {showPlatformToggle && (
        <div className="flex rounded-lg overflow-hidden border"
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
                backgroundColor: currentPlatform === p.key
                  ? (accentColor || '#017C87')
                  : 'transparent',
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

      {/* Ad frame */}
      {currentPlatform === 'facebook_feed' && (
        <FacebookFeedAd
          creativeUrl={creativeUrl}
          headline={headline}
          primaryText={primaryText}
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
          headline={headline}
          primaryText={primaryText}
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
  const hoverBg = dark ? '#3a3b3c' : '#f0f2f5';

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

      {/* Creative image */}
      <div className="w-full aspect-square bg-gray-100 overflow-hidden">
        <img
          src={creativeUrl}
          alt="Ad creative"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Link preview bar + CTA */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: dark ? '#3a3b3c' : '#f0f2f5' }}>
        <div className="flex-1 min-w-0 mr-3">
          {displayUrl && (
            <p className="text-[12px] uppercase tracking-wide truncate" style={{ color: textSecondary }}>
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

      {/* Creative image */}
      <div className="w-full aspect-square overflow-hidden">
        <img
          src={creativeUrl}
          alt="Ad creative"
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