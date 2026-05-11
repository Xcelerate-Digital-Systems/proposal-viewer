'use client';

import { Phone } from 'lucide-react';
import type { GoogleAdData } from '@/lib/types/feedback';

interface Props {
  /** Subset of fields actually used by the preview. */
  data: Pick<GoogleAdData,
    'final_url' | 'display_url' | 'path1' | 'path2' |
    'headlines' | 'descriptions' | 'sitelinks' | 'call_phone' | 'business_name'
  >;
  /** When false, render flat (no phone frame). Default true. */
  framed?: boolean;
}

/**
 * Mobile Google SERP mockup matching the Google Ads "preview" pane.
 * Combines headlines with " | " separators like the live SERP does and shows
 * up to two descriptions concatenated.
 */
export default function GoogleSearchAdMockupPreview({ data, framed = true }: Props) {
  const headline = (data.headlines || []).filter(Boolean).slice(0, 3).join(' | ') || 'Your headline here';
  const description = (data.descriptions || []).filter(Boolean).slice(0, 2).join(' ') || 'Your description appears here.';
  const displayPath = [data.display_url || 'example.com', data.path1, data.path2].filter(Boolean).join('/');

  const sitelinks = (data.sitelinks || []).filter((s) => s.text && s.url).slice(0, 6);

  const card = (
    <div className="w-full bg-white">
      {/* Sponsored row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-medium text-gray-900">Sponsored</span>
      </div>

      {/* Business identity row */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] font-semibold text-gray-500 shrink-0">
          {(data.business_name || data.display_url || 'A').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-900 truncate font-medium">{data.business_name || data.display_url || 'example.com'}</p>
          <p className="text-[10px] text-gray-500 truncate">{displayPath}</p>
        </div>
      </div>

      {/* Headline */}
      <h3 className="text-[16px] leading-[20px] text-[#1a0dab] cursor-pointer mb-1 line-clamp-2 break-words">
        {headline}
      </h3>

      {/* Description */}
      <p className="text-[13px] leading-[18px] text-[#4d5156] break-words">{description}</p>

      {/* Sitelinks — 2-column grid like the SERP */}
      {sitelinks.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-gray-100 pt-3">
          {sitelinks.map((s) => (
            <div key={s.id} className="min-w-0">
              <p className="text-[12px] text-[#1a0dab] truncate">{s.text}</p>
              {(s.description1 || s.description2) && (
                <p className="text-[10px] text-gray-500 truncate">{s.description1}{s.description2 ? ` ${s.description2}` : ''}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Call extension */}
      {data.call_phone && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-[12px] text-[#1a0dab] hover:bg-gray-50 transition-colors"
        >
          <Phone size={12} className="-rotate-90" />
          Call {data.call_phone}
        </button>
      )}
    </div>
  );

  if (!framed) {
    return <div className="w-full max-w-[360px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{card}</div>;
  }

  return (
    <div className="w-full max-w-[340px]">
      {/* Mobile phone frame */}
      <div className="rounded-[28px] border border-gray-300 bg-white shadow-lg overflow-hidden">
        {/* Notch */}
        <div className="h-6 bg-white flex items-center justify-center">
          <div className="w-16 h-1.5 rounded-full bg-gray-200" />
        </div>

        {/* Google bar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <svg width="60" height="20" viewBox="0 0 92 30" className="shrink-0">
            <text x="0" y="22" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="500">
              <tspan fill="#4285F4">G</tspan>
              <tspan fill="#EA4335">o</tspan>
              <tspan fill="#FBBC05">o</tspan>
              <tspan fill="#4285F4">g</tspan>
              <tspan fill="#34A853">l</tspan>
              <tspan fill="#EA4335">e</tspan>
            </text>
          </svg>
          <div className="flex-1 h-7 rounded-full bg-gray-100" />
        </div>

        {/* Ad card */}
        <div className="px-4 py-4">{card}</div>

        {/* Faux organic skeleton */}
        <div className="px-4 pb-6 space-y-4">
          <div>
            <div className="h-2 bg-gray-100 rounded w-1/2 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-5/6 mb-1" />
            <div className="h-2 bg-gray-50 rounded w-full" />
          </div>
          <div>
            <div className="h-2 bg-gray-100 rounded w-2/5 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-3/4 mb-1" />
            <div className="h-2 bg-gray-50 rounded w-full" />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center mt-3">
        Previews are examples and don&apos;t include all possible formats.
      </p>
    </div>
  );
}
