'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, MoreVertical, Search, Type, AlignLeft, MessageSquare, type LucideIcon } from 'lucide-react';
import type { GoogleAdData } from '@/lib/types/feedback';
import { googleAdAssetView, parseGoogleAdAssetView, type FeedbackItemView } from '@/lib/types/feedback';

interface Props {
  data: Pick<GoogleAdData,
    'final_url' | 'display_url' | 'path1' | 'path2' |
    'headlines' | 'descriptions' | 'sitelinks' | 'call_phone' | 'business_name'
  >;
  /** Active asset view ("headline-N" / "description-N"). Controls which row
   *  is selected in the sidebar and which copy renders in the SERP card. */
  activeView?: FeedbackItemView;
  /** Notify the parent when the reviewer picks a different asset. The parent
   *  uses this to scope the comments panel + composer to that asset. */
  onViewChange?: (view: FeedbackItemView) => void;
  /** Comment count keyed by view string ("headline-3" → 2). Renders a badge
   *  next to rows that already have feedback. */
  commentCountsByView?: Record<string, number>;
}

/**
 * Desktop Google SERP mockup with an asset sidebar. Reviewers click any
 * headline or description on the left to scope feedback to that asset — the
 * comments panel filters to that asset and new comments are stamped with it.
 */
export default function GoogleSearchAdMockupPreview({ data, activeView, onViewChange, commentCountsByView }: Props) {
  const headlines = (data.headlines || []).filter(Boolean);
  const descriptions = (data.descriptions || []).filter(Boolean);

  // activeView is single-dimensional (headline-N OR description-N) because it
  // doubles as the feedback target. The SERP card needs BOTH dimensions
  // selected at once though — switching from Headline 9 to Description 3
  // shouldn't snap the headline back to #1. We track the last-selected index
  // for each axis locally and sync from activeView whenever it matches.
  const parsed = parseGoogleAdAssetView(activeView ?? null);
  const [headlineIdx, setHeadlineIdx] = useState(parsed?.type === 'headline' ? parsed.index : 0);
  const [descIdx, setDescIdx] = useState(parsed?.type === 'description' ? parsed.index : 0);

  useEffect(() => {
    if (parsed?.type === 'headline') setHeadlineIdx(parsed.index);
    else if (parsed?.type === 'description') setDescIdx(parsed.index);
  }, [parsed?.type, parsed?.index]);

  const safeHeadlineIdx = Math.min(headlineIdx, Math.max(headlines.length - 1, 0));
  const safeDescIdx = Math.min(descIdx, Math.max(descriptions.length - 1, 0));

  const selectHeadline = (i: number) => onViewChange?.(googleAdAssetView('headline', i));
  const selectDescription = (i: number) => onViewChange?.(googleAdAssetView('description', i));

  const headline = headlines[safeHeadlineIdx] || 'Your headline here';
  const description = descriptions[safeDescIdx] || 'Your description appears here.';
  const displayPath = [data.display_url || 'example.com', data.path1, data.path2].filter(Boolean).join(' › ');

  const sitelinks = (data.sitelinks || []).filter((s) => s.text && s.url).slice(0, 6);

  return (
    <div className="w-full flex gap-4 items-start">
      {/* Asset sidebar */}
      <aside className="w-80 shrink-0 rounded-2xl border border-edge-strong bg-white shadow-sm overflow-hidden">
        <AssetSection
          icon={Type}
          label="Headlines"
          count={headlines.length}
          max={15}
          items={headlines}
          activeIdx={parsed?.type === 'headline' ? safeHeadlineIdx : -1}
          previewIdx={parsed?.type === 'headline' ? -1 : safeHeadlineIdx}
          onSelect={selectHeadline}
          charLimit={30}
          emptyHint="No headlines added"
          assetType="headline"
          commentCounts={commentCountsByView}
        />
        <AssetSection
          icon={AlignLeft}
          label="Descriptions"
          count={descriptions.length}
          max={4}
          items={descriptions}
          activeIdx={parsed?.type === 'description' ? safeDescIdx : -1}
          previewIdx={parsed?.type === 'description' ? -1 : safeDescIdx}
          onSelect={selectDescription}
          charLimit={90}
          emptyHint="No descriptions added"
          assetType="description"
          commentCounts={commentCountsByView}
        />
        <p className="px-3.5 py-3 text-detail text-faint border-t border-edge leading-snug">
          Click any headline or description to preview it on the right and leave feedback on that asset.
        </p>
      </aside>

      {/* SERP mockup card */}
      <div className="flex-1 rounded-2xl border border-edge-strong bg-white shadow-sm overflow-hidden">
        {/* Google header bar */}
        <div className="px-6 py-4 flex items-center gap-6 border-b border-edge">
          <svg width="92" height="30" viewBox="0 0 92 30" className="shrink-0">
            <text x="0" y="22" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="500">
              <tspan fill="#4285F4">G</tspan>
              <tspan fill="#EA4335">o</tspan>
              <tspan fill="#FBBC05">o</tspan>
              <tspan fill="#4285F4">g</tspan>
              <tspan fill="#34A853">l</tspan>
              <tspan fill="#EA4335">e</tspan>
            </text>
          </svg>
          <div className="flex-1 max-w-2xl h-11 rounded-full border border-edge-strong hover:shadow-md transition-shadow flex items-center gap-3 px-5">
            <div className="flex-1 h-3 rounded bg-surface" />
            <Search size={18} className="text-[#4285F4]" />
          </div>
          <div className="w-9 h-9 rounded-full bg-surface shrink-0" />
        </div>

        {/* Tabs row */}
        <div className="px-6 pt-3 border-b border-edge">
          <div className="flex items-center gap-6 text-caption text-prose">
            <span className="pb-2 border-b-2 border-[#1a73e8] text-[#1a73e8] font-medium">All</span>
            <span className="pb-2">Images</span>
            <span className="pb-2">Videos</span>
            <span className="pb-2">News</span>
            <span className="pb-2">Maps</span>
            <span className="pb-2">Shopping</span>
            <MoreVertical size={14} className="text-dim pb-1" />
          </div>
        </div>

        {/* Results body */}
        <div className="px-6 py-4 max-w-[680px]">
          <p className="text-xs text-dim mb-4">About 1,540,000,000 results (0.42 seconds)</p>

          {/* Ad card */}
          <div className="mb-6">
            <p className="text-xs font-medium text-ink mb-1.5">Sponsored</p>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-full bg-surface border border-edge-strong flex items-center justify-center text-2xs font-semibold text-dim shrink-0">
                {(data.business_name || data.display_url || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-ink truncate font-medium leading-tight">
                  {data.business_name || data.display_url || 'example.com'}
                </p>
                <p className="text-xs text-dim truncate leading-tight">{displayPath}</p>
              </div>
            </div>

            <h3 className="text-xl leading-[26px] text-[#1a0dab] cursor-pointer mt-1 mb-1 line-clamp-2 break-words font-normal">
              {headline}
            </h3>

            <p className="text-sm leading-[22px] text-[#4d5156] break-words">{description}</p>

            {sitelinks.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
                {sitelinks.map((s) => (
                  <div key={s.id} className="min-w-0">
                    <p className="text-sm text-[#1a0dab] truncate cursor-pointer hover:underline">{s.text}</p>
                    {(s.description1 || s.description2) && (
                      <p className="text-xs text-dim line-clamp-2">
                        {s.description1}{s.description2 ? ` ${s.description2}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data.call_phone && (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-edge-strong text-caption text-[#1a0dab] hover:bg-surface transition-colors"
              >
                <Phone size={13} className="-rotate-90" />
                Call {data.call_phone}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-surface" />
              <div>
                <div className="h-2.5 bg-surface rounded w-32 mb-1" />
                <div className="h-2 bg-surface rounded w-40" />
              </div>
            </div>
            <div className="h-4 bg-surface rounded w-3/5 mt-1.5" />
            <div className="h-2.5 bg-surface rounded w-full" />
            <div className="h-2.5 bg-surface rounded w-5/6" />
          </div>
        </div>

        <p className="text-2xs text-faint text-center pb-3">
          Previews are examples and don&apos;t include all possible formats.
        </p>
      </div>
    </div>
  );
}

interface AssetSectionProps {
  icon: LucideIcon;
  label: string;
  count: number;
  max: number;
  items: string[];
  /** Row that is the current comment target — strong blue highlight. */
  activeIdx: number;
  /** Row that is currently rendering in the SERP card but isn't the comment
   *  target (i.e. user picked the other axis last). Soft grey background. */
  previewIdx: number;
  onSelect: (idx: number) => void;
  charLimit: number;
  emptyHint: string;
  assetType: 'headline' | 'description';
  commentCounts?: Record<string, number>;
}

function AssetSection({
  icon: Icon, label, count, max, items, activeIdx, previewIdx, onSelect, charLimit, emptyHint, assetType, commentCounts,
}: AssetSectionProps) {
  return (
    <div className="border-b border-edge last:border-b-0">
      <div className="px-3.5 py-2.5 flex items-center gap-2 bg-surface/60">
        <Icon size={15} className="text-dim" />
        <p className="text-xs font-semibold uppercase tracking-wide text-prose flex-1">
          {label}
        </p>
        <span className="text-detail tabular-nums text-faint">{count}/{max}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-3.5 py-3 text-xs text-faint italic">{emptyHint}</p>
      ) : (
        <ul className="py-1.5">
          {items.map((text, i) => {
            const active = i === activeIdx;
            const previewing = i === previewIdx;
            const over = text.length > charLimit;
            const commentCount = commentCounts?.[`${assetType}-${i}`] ?? 0;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-caption leading-snug transition-colors ${
                    active
                      ? 'bg-blue-50 text-[#1a0dab]'
                      : previewing
                        ? 'bg-surface text-ink'
                        : 'text-prose hover:bg-surface'
                  }`}
                  title={text}
                >
                  <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded text-detail font-medium shrink-0 ${
                    active
                      ? 'bg-[#1a0dab] text-white'
                      : previewing
                        ? 'bg-edge text-prose'
                        : 'bg-surface text-dim'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{text}</span>
                    {over && (
                      <span className="block text-detail text-amber-600 mt-0.5">
                        {text.length}/{charLimit} chars
                      </span>
                    )}
                  </span>
                  {commentCount > 0 && (
                    <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-amber-100 text-amber-700 text-2xs font-medium shrink-0">
                      <MessageSquare size={10} />
                      {commentCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
