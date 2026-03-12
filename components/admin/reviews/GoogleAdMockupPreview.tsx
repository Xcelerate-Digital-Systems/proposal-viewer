// components/admin/reviews/GoogleAdMockupPreview.tsx
'use client';

import { useState } from 'react';
import type { GoogleAdFormat } from '@/lib/types/review';

/* ─── Types ──────────────────────────────────────────────────────── */

interface GoogleAdMockupPreviewProps {
  format: GoogleAdFormat;
  headline: string;
  description1: string;
  description2?: string;
  displayUrl: string;
  finalUrl?: string;
  /** Display ad banner image */
  creativeUrl?: string;
  showFormatToggle?: boolean;
  onFormatChange?: (format: GoogleAdFormat) => void;
}

/* ─── Search Ad Mockup ───────────────────────────────────────────── */

function SearchAdMockup({
  headline, description1, description2, displayUrl,
}: Pick<GoogleAdMockupPreviewProps, 'headline' | 'description1' | 'description2' | 'displayUrl'>) {
  return (
    <div className="w-full max-w-[600px] bg-white rounded-lg border border-gray-200 p-4">
      {/* Google logo hint */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span className="text-xs text-gray-400">Google Search</span>
      </div>

      {/* Sponsored label */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Sponsored</span>
      </div>

      {/* Display URL */}
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-xs text-[#202124]">{displayUrl || 'example.com'}</span>
      </div>

      {/* Headline */}
      <h3 className="text-lg text-[#1a0dab] hover:underline cursor-pointer leading-tight mb-1">
        {headline || 'Your Ad Headline'}
      </h3>

      {/* Descriptions */}
      <p className="text-sm text-[#4d5156] leading-relaxed">
        {description1 || 'Your ad description appears here.'}
        {description2 && ` ${description2}`}
      </p>
    </div>
  );
}

/* ─── Display Ad Mockup ──────────────────────────────────────────── */

function DisplayAdMockup({
  headline, creativeUrl, displayUrl,
}: Pick<GoogleAdMockupPreviewProps, 'headline' | 'creativeUrl' | 'displayUrl'>) {
  return (
    <div className="w-full max-w-[336px] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Banner */}
      <div className="w-full aspect-[336/280] bg-gray-50 relative">
        {creativeUrl ? (
          <img src={creativeUrl} alt="Ad banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            336 x 280
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {headline || 'Your Headline'}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{displayUrl || 'example.com'}</p>
          </div>
          <span className="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">Ad</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */

export default function GoogleAdMockupPreview({
  format: initialFormat,
  headline,
  description1,
  description2,
  displayUrl,
  creativeUrl,
  showFormatToggle = false,
  onFormatChange,
}: GoogleAdMockupPreviewProps) {
  const [format, setFormat] = useState<GoogleAdFormat>(initialFormat);

  const handleFormatChange = (f: GoogleAdFormat) => {
    setFormat(f);
    onFormatChange?.(f);
  };

  return (
    <div className="space-y-3">
      {showFormatToggle && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(['search', 'display'] as GoogleAdFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFormatChange(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  format === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'search' ? 'Search Ad' : 'Display Ad'}
              </button>
            ))}
          </div>
        </div>
      )}

      {format === 'search' ? (
        <SearchAdMockup
          headline={headline}
          description1={description1}
          description2={description2}
          displayUrl={displayUrl}
        />
      ) : (
        <DisplayAdMockup
          headline={headline}
          creativeUrl={creativeUrl}
          displayUrl={displayUrl}
        />
      )}
    </div>
  );
}
