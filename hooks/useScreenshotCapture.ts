// hooks/useScreenshotCapture.ts
'use client';

import { useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';

interface UseScreenshotCaptureOptions {
  /** The share token for the review project */
  shareToken?: string;
  /** The current review item ID */
  itemId?: string | null;
}

/**
 * Captures a screenshot of the content area using html2canvas
 * and uploads it to the screenshot API endpoint.
 */
export function useScreenshotCapture({
  shareToken,
  itemId,
}: UseScreenshotCaptureOptions) {
  const capturingRef = useRef(false);

  const capture = useCallback(
    async (containerEl: HTMLElement | null): Promise<string | null> => {
      if (!containerEl || !shareToken || !itemId || capturingRef.current) return null;

      capturingRef.current = true;
      try {
        const canvas = await html2canvas(containerEl, {
          useCORS: true,
          allowTaint: true,
          scale: 1, // 1x for reasonable file size
          logging: false,
          backgroundColor: '#f9fafb', // gray-50
        });

        const dataUrl = canvas.toDataURL('image/png');

        const res = await fetch(`/api/review-widget/${shareToken}/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: itemId, image: dataUrl }),
        });

        if (res.ok) {
          const { url } = await res.json();
          return url as string;
        }

        return null;
      } catch (err) {
        console.error('Screenshot capture failed:', err);
        return null;
      } finally {
        capturingRef.current = false;
      }
    },
    [shareToken, itemId]
  );

  return { capture, capturing: capturingRef.current };
}
