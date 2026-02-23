// components/viewer/ViewerLoader.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2 } from 'lucide-react';
import { CompanyBranding } from '@/hooks/useProposal';
import GoogleFontLoader from './GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';

interface ViewerLoaderProps {
  branding: CompanyBranding;
  /** When true the bar auto-advances to ~85 %; when false it completes to 100 % and fades out. */
  loading: boolean;
  /** Optional label beneath the bar, e.g. "Loading proposal…" */
  label?: string;
  /** Minimum time (ms) the loader stays visible so branding is seen. Default 1200. */
  minDisplayTime?: number;
}

export default function ViewerLoader({ branding, loading, label, minDisplayTime = 1200 }: ViewerLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const accent = branding.accent_color || '#ff6700';
  const textColor = branding.sidebar_text_color || '#ffffff';

  // Enforce minimum display time
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), minDisplayTime);
    return () => clearTimeout(timer);
  }, [minDisplayTime]);

  // Simulate progress: advance towards 85% while loading
  useEffect(() => {
    if (loading) {
      // Quick initial jump
      setProgress(12);

      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) return prev;
          // Slow down as we approach 85%
          const remaining = 85 - prev;
          const step = Math.max(0.5, remaining * 0.08);
          return Math.min(85, prev + step);
        });
      }, 100);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading]);

  // When loading completes AND minimum time has elapsed, jump to 100% then fade out
  useEffect(() => {
    if (!loading && minTimeElapsed) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, minTimeElapsed]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        progress >= 100 ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: bgPrimary }}
    >
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body]} />

      <div className="flex flex-col items-center gap-6 w-full max-w-[240px] px-6">
        {/* Logo or company name */}
        <div className="flex items-center justify-center min-h-[40px]">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.name}
              className="max-h-10 max-w-[200px] object-contain"
            />
          ) : branding.name ? (
            <div className="flex items-center gap-2.5">
              <Building2 size={22} style={{ color: `${textColor}55` }} />
              <span
                className="text-base font-semibold"
                style={{
                  color: textColor,
                  fontFamily: fontFamily(branding.font_heading),
                  fontWeight: branding.font_heading_weight ? Number(branding.font_heading_weight) : undefined,
                }}
              >
                {branding.name}
              </span>
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-lg"
              style={{ backgroundColor: `${textColor}10` }}
            />
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2.5">
          <div
            className="w-full h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: `${textColor}10` }}
          >
            <div
              className="h-full rounded-full transition-all ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: accent,
                transitionDuration: progress >= 100 ? '300ms' : '400ms',
              }}
            />
          </div>

          {/* Percentage + label */}
          <div className="flex items-center justify-between">
            <span
              className="text-[11px]"
              style={{
                color: `${textColor}40`,
                fontFamily: fontFamily(branding.font_body),
                fontWeight: branding.font_body_weight ? Number(branding.font_body_weight) : undefined,
              }}
            >
              {label || 'Loading…'}
            </span>
            <span
              className="text-[11px] font-medium tabular-nums"
              style={{ color: `${textColor}50` }}
            >
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}