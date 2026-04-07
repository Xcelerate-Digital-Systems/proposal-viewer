// components/admin/ads/swipe/SwipeMetaMockup.tsx
'use client';

import { useState } from 'react';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe } from 'lucide-react';
import type { SwipeFile } from '@/lib/supabase';

/** Character threshold above which primary text is collapsed behind a "See more" link. */
const COLLAPSE_THRESHOLD = 180;

type Props = {
  file: SwipeFile;
  /** Compact mode shrinks padding + typography for card grids */
  compact?: boolean;
};

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
  } catch {
    return null;
  }
}

/**
 * Meta Facebook feed-style mockup for a swipe file. Handles both image and
 * video media, and gracefully hides empty copy fields.
 */
export default function SwipeMetaMockup({ file, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pageName = file.brand || 'Brand';
  const displayUrl = hostFromUrl(file.source_url);
  const isVideo = file.media_type === 'video';

  const primary = file.primary_text || '';
  const shouldCollapse = primary.length > COLLAPSE_THRESHOLD;
  const visiblePrimary = shouldCollapse && !expanded
    ? primary.slice(0, COLLAPSE_THRESHOLD).trimEnd() + '…'
    : primary;

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#e4e6e9] bg-white">
      {/* Page header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div
          className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            fontSize: (compact ? 32 : 40) * 0.4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          {pageName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-[#050505] ${compact ? 'text-[12px]' : 'text-[13px]'} truncate`}>
            {pageName}
          </div>
          <div className="flex items-center gap-1">
            <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-[#65676b]`}>Sponsored</span>
            <span className="text-[11px] text-[#65676b]">·</span>
            <Globe size={10} className="text-[#65676b]" />
          </div>
        </div>
        <MoreHorizontal size={compact ? 16 : 20} className="text-[#65676b] shrink-0" />
      </div>

      {/* Primary text (collapsed with "See more" if long) */}
      {primary && (
        <div className="px-4 pb-2.5">
          <p className={`${compact ? 'text-[12px] leading-[16px]' : 'text-[15px] leading-[20px]'} text-[#050505] whitespace-pre-wrap`}>
            {visiblePrimary}
            {shouldCollapse && !expanded && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                  className="text-[#65676b] hover:underline font-medium"
                >
                  See more
                </button>
              </>
            )}
            {shouldCollapse && expanded && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                  className="text-[#65676b] hover:underline font-medium"
                >
                  See less
                </button>
              </>
            )}
          </p>
        </div>
      )}

      {/* Media */}
      <div className="w-full bg-gray-100 overflow-hidden">
        {file.media_url ? (
          isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={file.media_url} controls className="w-full block" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.media_url} alt="" className="w-full block" />
          )
        ) : (
          <div className="aspect-square flex items-center justify-center text-xs text-[#65676b]">No media</div>
        )}
      </div>

      {/* Link preview bar + CTA */}
      {(file.headline || file.description || displayUrl || file.cta) && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5]">
          <div className="flex-1 min-w-0 mr-3">
            {displayUrl && (
              <p className={`${compact ? 'text-[10px]' : 'text-[12px]'} uppercase tracking-wide truncate text-[#65676b]`}>
                {displayUrl}
              </p>
            )}
            {file.headline && (
              <p className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold leading-tight text-[#050505] truncate`}>
                {file.headline}
              </p>
            )}
            {file.description && (
              <p className={`${compact ? 'text-[11px]' : 'text-[13px]'} text-[#65676b] truncate`}>
                {file.description}
              </p>
            )}
          </div>
          {file.cta && (
            <span
              className={`shrink-0 ${compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-[13px]'} rounded-md font-semibold bg-[#e4e6e9] text-[#050505]`}
            >
              {file.cta}
            </span>
          )}
        </div>
      )}

      {/* Engagement bar */}
      <div className="px-4 py-1 border-t border-[#e4e6e9]">
        <div className="flex items-center justify-between py-1">
          {[
            { icon: ThumbsUp, label: 'Like' },
            { icon: MessageCircle, label: 'Comment' },
            { icon: Share2, label: 'Share' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 ${compact ? 'px-2 py-1 text-[11px]' : 'px-4 py-2 text-[13px]'} rounded-md font-semibold text-[#65676b]`}
            >
              <Icon size={compact ? 14 : 18} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
