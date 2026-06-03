// hooks/useScreenshotCapture.ts
'use client';

import { useCallback, useRef, useState } from 'react';
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
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);

  const capture = useCallback(
    async (containerEl: HTMLElement | null, opts?: CaptureOptions): Promise<string | null> => {
      if (!containerEl || !shareToken || !itemId || capturingRef.current) return null;

      capturingRef.current = true;
      setCapturing(true);
      try {
        // Scroll the nearest scrollable ancestor so the pin area is in view.
        // html2canvas uses viewport-relative positioning, so elements scrolled
        // out of the parent's visible area can be misrendered or clipped.
        let scrollParent: HTMLElement | null = null;
        let savedScrollTop = 0;
        let savedScrollLeft = 0;
        if (opts?.cropAroundPct) {
          scrollParent = containerEl.parentElement;
          while (scrollParent && scrollParent.scrollHeight <= scrollParent.clientHeight) {
            scrollParent = scrollParent.parentElement;
          }
          if (scrollParent) {
            savedScrollTop = scrollParent.scrollTop;
            savedScrollLeft = scrollParent.scrollLeft;
            const pinY = (opts.cropAroundPct.y / 100) * containerEl.offsetHeight;
            const pinX = (opts.cropAroundPct.x / 100) * containerEl.offsetWidth;
            const containerRect = containerEl.getBoundingClientRect();
            const parentRect = scrollParent.getBoundingClientRect();
            const offsetTop = containerRect.top - parentRect.top + scrollParent.scrollTop;
            const offsetLeft = containerRect.left - parentRect.left + scrollParent.scrollLeft;
            scrollParent.scrollTop = offsetTop + pinY - scrollParent.clientHeight / 2;
            scrollParent.scrollLeft = offsetLeft + pinX - scrollParent.clientWidth / 2;
          }
        }

        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const canvas = await html2canvas(containerEl, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false,
          backgroundColor: '#f9fafb',
          ignoreElements: (el) => {
            if (el.classList?.contains('z-40') || el.classList?.contains('z-50')) return true;
            return false;
          },
        });

        if (scrollParent) {
          scrollParent.scrollTop = savedScrollTop;
          scrollParent.scrollLeft = savedScrollLeft;
        }

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
        setCapturing(false);
      }
    },
    [shareToken, itemId]
  );

  return { capture, capturing };
}
