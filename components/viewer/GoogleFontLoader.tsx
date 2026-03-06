// components/viewer/GoogleFontLoader.tsx
'use client';

import { useEffect } from 'react';

interface GoogleFontLoaderProps {
  fonts: (string | null | undefined)[];
}

/**
 * Injects a Google Fonts <link> into <head> for the given font families.
 * Requests each font with the full variable weight axis (100..900) so any
 * branding-configured weight is always available — on both the main domain
 * and custom domains where no other font loading occurs.
 */
function buildFontUrl(fonts: (string | null | undefined)[]): string | null {
  const families = Array.from(new Set(fonts.filter(Boolean) as string[]));
  if (families.length === 0) return null;

  const params = families
    .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,100..900;1,100..900`)
    .join('&');

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export default function GoogleFontLoader({ fonts }: GoogleFontLoaderProps) {
  const cacheKey = fonts.filter(Boolean).sort().join(',');

  useEffect(() => {
    const url = buildFontUrl(fonts);
    if (!url) return;

    // Avoid duplicate links
    if (document.querySelector(`link[data-agv-fonts="${cacheKey}"]`)) return;

    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect);

    const preconnectStatic = document.createElement('link');
    preconnectStatic.rel = 'preconnect';
    preconnectStatic.href = 'https://fonts.gstatic.com';
    preconnectStatic.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectStatic);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.agvFonts = cacheKey;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(preconnect);
      document.head.removeChild(preconnectStatic);
    };
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}