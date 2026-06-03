// hooks/useScreenshotCapture.ts
'use client';

import { useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';

interface UseScreenshotCaptureOptions {
  /** The share token for the feedback project */
  shareToken?: string;
  /** The current feedback item ID */
  itemId?: string | null;
}

interface CaptureOptions {
  /** Crop a 16:9 region centred on these container-relative percentages (0-100). */
  cropAroundPct?: { x: number; y: number };
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
    async (containerEl: HTMLElement | null, opts?: CaptureOptions): Promise<string | null> => {
      if (!containerEl || !shareToken || !itemId || capturingRef.current) return null;

      capturingRef.current = true;
      try {
        const canvas = await html2canvas(containerEl, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false,
          backgroundColor: '#f9fafb',
          ignoreElements: (el) => {
            // Exclude popovers / fixed overlays — keep pin markers.
            if (el.classList?.contains('z-40') || el.classList?.contains('z-50')) return true;
            return false;
          },
        });

        let outCanvas: HTMLCanvasElement = canvas;
        if (opts?.cropAroundPct) {
          const dw = Math.min(canvas.width, 1280);
          const dh = Math.min(canvas.height, Math.round((dw * 9) / 16));
          if (dw > 20 && dh > 20) {
            const pinX = (opts.cropAroundPct.x / 100) * canvas.width;
            const pinY = (opts.cropAroundPct.y / 100) * canvas.height;
            const sx = Math.max(0, Math.min(canvas.width - dw, Math.round(pinX - dw / 2)));
            const sy = Math.max(0, Math.min(canvas.height - dh, Math.round(pinY - dh / 2)));
            const dest = document.createElement('canvas');
            dest.width = dw;
            dest.height = dh;
            const ctx = dest.getContext('2d');
            if (ctx) {
              ctx.drawImage(canvas, sx, sy, dw, dh, 0, 0, dw, dh);
              outCanvas = dest;
            }
          }
        }

        const dataUrl = outCanvas.toDataURL('image/jpeg', 0.85);

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
