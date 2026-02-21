// components/viewer/GoogleFontLoader.tsx
'use client';

import { useEffect } from 'react';
import { buildGoogleFontsUrl } from '@/lib/google-fonts';

interface GoogleFontLoaderProps {
  fonts: (string | null | undefined)[];
}

/**
 * Injects a Google Fonts <link> into <head> for the given font families.
 * Only loads fonts that are actually set (non-null).
 * Cleans up on unmount.
 */
export default function GoogleFontLoader({ fonts }: GoogleFontLoaderProps) {
  useEffect(() => {
    const url = buildGoogleFontsUrl(fonts);
    if (!url) return;

    // Avoid duplicate links
    const existing = document.querySelector(`link[href="${url}"]`);
    if (existing) return;

    // Preconnect to Google Fonts for faster loading
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect);

    const preconnectStatic = document.createElement('link');
    preconnectStatic.rel = 'preconnect';
    preconnectStatic.href = 'https://fonts.gstatic.com';
    preconnectStatic.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectStatic);

    // Load the fonts
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(preconnect);
      document.head.removeChild(preconnectStatic);
    };
  }, [fonts.filter(Boolean).sort().join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}