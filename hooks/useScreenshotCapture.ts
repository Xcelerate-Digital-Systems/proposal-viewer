// hooks/useScreenshotCapture.ts
'use client';

import { useCallback, useRef, useState } from 'react';

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

const PIN_SIZE = 28;
const PIN_COLOR = '#16A34A';

/**
 * Try to capture by drawing the <img> directly onto a canvas.
 * Draws the <img> directly onto a canvas — fast, reliable, no DOM walking.
 * Returns null if the container doesn't have a usable <img>.
 */
function captureFromImg(
  containerEl: HTMLElement,
  opts?: CaptureOptions
): HTMLCanvasElement | null {
  const img = containerEl.querySelector('img[data-screenshot-source]') as HTMLImageElement | null;
  if (!img || !img.naturalWidth || !img.complete) return null;

  // Full canvas at natural image resolution
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Draw the image
  try {
    ctx.drawImage(img, 0, 0, nw, nh);
    // Test that we can actually read the pixels (CORS check)
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    // Tainted canvas — fall back to html-to-image
    return null;
  }

  // Draw pin marker
  if (opts?.cropAroundPct) {
    const px = (opts.cropAroundPct.x / 100) * nw;
    const py = (opts.cropAroundPct.y / 100) * nh;
    const r = PIN_SIZE / 2;

    // Green circle
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = PIN_COLOR;
    ctx.fill();

    // White border
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // "+" text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', px, py);
  }

  // Crop to 16:9 around pin
  if (opts?.cropAroundPct) {
    const dw = Math.min(nw, 1280);
    const dh = Math.min(nh, Math.round((dw * 9) / 16));
    if (dw > 20 && dh > 20) {
      const pinX = (opts.cropAroundPct.x / 100) * nw;
      const pinY = (opts.cropAroundPct.y / 100) * nh;
      const sx = Math.max(0, Math.min(nw - dw, Math.round(pinX - dw / 2)));
      const sy = Math.max(0, Math.min(nh - dh, Math.round(pinY - dh / 2)));
      const dest = document.createElement('canvas');
      dest.width = dw;
      dest.height = dh;
      const dctx = dest.getContext('2d');
      if (dctx) {
        dctx.drawImage(canvas, sx, sy, dw, dh, 0, 0, dw, dh);
        return dest;
      }
    }
  }

  return canvas;
}

/**
 * Captures a screenshot of the content area — prefers direct <img> draw
 * (fast, reliable), falls back to html-to-image for HTML mockups (email, SMS, ads).
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
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Fast path: draw <img> directly (image + ad assets)
        const directCanvas = captureFromImg(containerEl, opts);

        let outCanvas: HTMLCanvasElement;

        if (directCanvas) {
          outCanvas = directCanvas;
        } else {
          // Fallback: html-to-image for HTML mockups (email, SMS, ads, Google ads)
          const { toCanvas } = await import('html-to-image');

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

          const canvas = await toCanvas(containerEl, {
            pixelRatio: 1,
            backgroundColor: '#f9fafb',
            filter: (el: Element) => {
              if (el instanceof HTMLElement) {
                if (el.classList?.contains('z-40') || el.classList?.contains('z-50')) return false;
              }
              return true;
            },
          });

          if (scrollParent) {
            scrollParent.scrollTop = savedScrollTop;
            scrollParent.scrollLeft = savedScrollLeft;
          }

          outCanvas = canvas;
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
