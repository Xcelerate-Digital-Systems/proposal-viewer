'use client';

import { useState } from 'react';
import { Phone, MoreVertical, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GoogleAdData } from '@/lib/types/feedback';

interface Props {
  data: Pick<GoogleAdData,
    'final_url' | 'display_url' | 'path1' | 'path2' |
    'headlines' | 'descriptions' | 'sitelinks' | 'call_phone' | 'business_name'
  >;
}

/**
 * Desktop Google SERP mockup. Renders the ad card in the same chrome a viewer
 * would see on google.com so reviewers can leave pins on the realistic layout.
 *
 * Google's responsive search ads rotate combinations of up to 15 headlines /
 * 4 descriptions, so we offer a per-variant cycler that walks through
 * 3-headline + 2-description chunks of the supplied copy.
 */
export default function GoogleSearchAdMockupPreview({ data }: Props) {
  const headlines = (data.headlines || []).filter(Boolean);
  const descriptions = (data.descriptions || []).filter(Boolean);

  const variantCount = Math.max(
    Math.ceil(headlines.length / 3),
    Math.ceil(descriptions.length / 2),
    1,
  );

  const [variant, setVariant] = useState(0);
  const safeVariant = Math.min(variant, variantCount - 1);

  const variantHeadlines = headlines.slice(safeVariant * 3, safeVariant * 3 + 3);
  const variantDescriptions = descriptions.slice(safeVariant * 2, safeVariant * 2 + 2);

  const headline = variantHeadlines.join(' | ') || 'Your headline here';
  const description = variantDescriptions.join(' ') || 'Your description appears here.';
  const displayPath = [data.display_url || 'example.com', data.path1, data.path2].filter(Boolean).join(' › ');

  const sitelinks = (data.sitelinks || []).filter((s) => s.text && s.url).slice(0, 6);

  const showCycler = variantCount > 1;
  const goPrev = () => setVariant((v) => (v - 1 + variantCount) % variantCount);
  const goNext = () => setVariant((v) => (v + 1) % variantCount);

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Google header bar */}
      <div className="px-6 py-4 flex items-center gap-6 border-b border-gray-100">
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
        <div className="flex-1 max-w-2xl h-11 rounded-full border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 px-5">
          <div className="flex-1 h-3 rounded bg-gray-100" />
          <Search size={18} className="text-[#4285F4]" />
        </div>
        <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
      </div>

      {/* Tabs row */}
      <div className="px-6 pt-3 border-b border-gray-100">
        <div className="flex items-center gap-6 text-[13px] text-gray-600">
          <span className="pb-2 border-b-2 border-[#1a73e8] text-[#1a73e8] font-medium">All</span>
          <span className="pb-2">Images</span>
          <span className="pb-2">Videos</span>
          <span className="pb-2">News</span>
          <span className="pb-2">Maps</span>
          <span className="pb-2">Shopping</span>
          <MoreVertical size={14} className="text-gray-500 pb-1" />
        </div>
      </div>

      {/* Results body */}
      <div className="px-6 py-4 max-w-[680px]">
        <p className="text-[12px] text-gray-500 mb-4">About 1,540,000,000 results (0.42 seconds)</p>

        {/* Variant cycler — only shown when more than one combo is possible */}
        {showCycler && (
          <div className="mb-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-ink hover:border-gray-300 flex items-center justify-center transition-colors"
              title="Previous variant"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] text-gray-500 tabular-nums">
              Variant {safeVariant + 1} / {variantCount}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-ink hover:border-gray-300 flex items-center justify-center transition-colors"
              title="Next variant"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Ad card */}
        <div className="mb-6">
          {/* Sponsored */}
          <p className="text-[12px] font-medium text-gray-900 mb-1.5">Sponsored</p>

          {/* Business identity row */}
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
              {(data.business_name || data.display_url || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-gray-900 truncate font-medium leading-tight">
                {data.business_name || data.display_url || 'example.com'}
              </p>
              <p className="text-[12px] text-gray-500 truncate leading-tight">{displayPath}</p>
            </div>
          </div>

          {/* Headline */}
          <h3 className="text-[20px] leading-[26px] text-[#1a0dab] cursor-pointer mt-1 mb-1 line-clamp-2 break-words font-normal">
            {headline}
          </h3>

          {/* Description */}
          <p className="text-[14px] leading-[22px] text-[#4d5156] break-words">{description}</p>

          {/* Sitelinks — 2-column grid */}
          {sitelinks.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {sitelinks.map((s) => (
                <div key={s.id} className="min-w-0">
                  <p className="text-[14px] text-[#1a0dab] truncate cursor-pointer hover:underline">{s.text}</p>
                  {(s.description1 || s.description2) && (
                    <p className="text-[12px] text-gray-500 line-clamp-2">
                      {s.description1}{s.description2 ? ` ${s.description2}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Call extension */}
          {data.call_phone && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-200 text-[13px] text-[#1a0dab] hover:bg-gray-50 transition-colors"
            >
              <Phone size={13} className="-rotate-90" />
              Call {data.call_phone}
            </button>
          )}
        </div>

        {/* Faux organic skeleton — one result so the ad sits in context */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100" />
            <div>
              <div className="h-2.5 bg-gray-100 rounded w-32 mb-1" />
              <div className="h-2 bg-gray-50 rounded w-40" />
            </div>
          </div>
          <div className="h-4 bg-gray-100 rounded w-3/5 mt-1.5" />
          <div className="h-2.5 bg-gray-50 rounded w-full" />
          <div className="h-2.5 bg-gray-50 rounded w-5/6" />
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center pb-3">
        Previews are examples and don&apos;t include all possible formats.
      </p>
    </div>
  );
}
