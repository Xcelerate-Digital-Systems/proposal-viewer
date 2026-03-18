// components/viewer/GoogleFontLoader.tsx
'use client';

import { useEffect } from 'react';
import { buildGoogleFontsUrl, buildFontshareUrl } from '@/lib/google-fonts';

interface GoogleFontLoaderProps {
  fonts: (string | null | undefined)[];
}

/**
 * Injects font <link> tags into <head> for the given font families.
 * - Google Fonts families are loaded via fonts.googleapis.com
 * - Fontshare families (e.g. Clash Grotesk) are loaded via api.fontshare.com
 * - Fonts marked local: true with no fontshare slug are skipped (expected via @font-face)
 *
 * Previously used an inline buildFontUrl that sent ALL fonts (including local-only ones
 * like Clash Grotesk) to Google Fonts, which returned 400 and caused the entire
 * font request to fail — leaving everything falling back to the body default.
 */
export default function GoogleFontLoader({ fonts }: GoogleFontLoaderProps) {
  const cacheKey = fonts.filter(Boolean).sort().join(',');

  useEffect(() => {
    const googleUrl = buildGoogleFontsUrl(fonts);
    const fontshareUrl = buildFontshareUrl(fonts);

    if (!googleUrl && !fontshareUrl) return;

    const injected: HTMLLinkElement[] = [];

    if (googleUrl) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = 'https://fonts.googleapis.com';
      document.head.appendChild(preconnect);
      injected.push(preconnect);

      const preconnectStatic = document.createElement('link');
      preconnectStatic.rel = 'preconnect';
      preconnectStatic.href = 'https://fonts.gstatic.com';
      preconnectStatic.crossOrigin = 'anonymous';
      document.head.appendChild(preconnectStatic);
      injected.push(preconnectStatic);

      if (!document.querySelector(`link[data-agv-gfonts="${cacheKey}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = googleUrl;
        link.dataset.agvGfonts = cacheKey;
        document.head.appendChild(link);
        injected.push(link);
      }
    }

    if (fontshareUrl && !document.querySelector(`link[data-agv-fontshare="${cacheKey}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontshareUrl;
      link.dataset.agvFontshare = cacheKey;
      document.head.appendChild(link);
      injected.push(link);
    }

    return () => {
      injected.forEach((el) => {
        if (document.head.contains(el)) document.head.removeChild(el);
      });
    };
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
