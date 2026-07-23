// hooks/useScreenshotCapture.ts
'use client';

import { useCallback, useRef, useState } from 'react';

interface UseScreenshotCaptureOptions {
  shareToken?: string;
  itemId?: string | null;
}

interface CaptureOptions {
  cropAroundPct?: { x: number; y: number };
}

const PIN_SIZE = 28;
const PIN_COLOR = '#16A34A';

/**
 * Fetch an image URL as a blob and return an HTMLImageElement from it.
 * This bypasses the browser's CORS cache — even if the <img> element
 * loaded without CORS headers, this fetch gets a fresh response with them.
 */
async function fetchAsImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

/**
 * Capture by drawing the <img> directly onto a canvas.
 * Fetches the image as a blob to avoid CORS cache issues.
 */
async function captureFromImg(
  containerEl: HTMLElement,
  opts?: CaptureOptions
): Promise<HTMLCanvasElement | null> {
  const img = containerEl.querySelector('img[data-screenshot-source]') as HTMLImageElement | null;
  if (!img || !img.naturalWidth || !img.complete) return null;

  // Fetch as blob to bypass CORS cache, fall back to the DOM element
  const freshImg = await fetchAsImage(img.src) || img;
  const nw = freshImg.naturalWidth;
  const nh = freshImg.naturalHeight;
  if (!nw || !nh) return null;

  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(freshImg, 0, 0, nw, nh);

  // Verify the canvas isn't tainted
  try {
    canvas.toDataURL();
  } catch {
    return null;
  }

  // Draw pin marker
  if (opts?.cropAroundPct) {
    const px = (opts.cropAroundPct.x / 100) * nw;
    const py = (opts.cropAroundPct.y / 100) * nh;
    const r = PIN_SIZE / 2;

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = PIN_COLOR;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
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
 * Wait for all <img> elements in the container to finish loading.
 * Resolves immediately if all are already complete, otherwise waits
 * for `load`/`error` events with a hard timeout fallback.
 */
function waitForImages(container: HTMLElement, timeoutMs = 2000): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  const pending = imgs.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = setTimeout(settle, timeoutMs);

    let remaining = pending.length;
    const onDone = () => {
      remaining--;
      if (remaining <= 0) {
        clearTimeout(timer);
        settle();
      }
    };
    for (const img of pending) {
      img.addEventListener('load', onDone, { once: true });
      img.addEventListener('error', onDone, { once: true });
    }
  });
}

/**
 * Captures a screenshot of the content area — prefers direct <img> draw
 * (fast, reliable), falls back to html-to-image for HTML mockups.
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
        await waitForImages(containerEl);

        // Fast path: draw <img> directly (image assets)
        const directCanvas = await captureFromImg(containerEl, opts);

        let outCanvas: HTMLCanvasElement;

        if (directCanvas) {
          outCanvas = directCanvas;
        } else {
          // Fallback: html-to-image for HTML mockups (email, SMS, ads, etc.)
          // cacheBust avoids stale CORS cache entries for embedded images.
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

          // Wait for scroll to settle and images to load after repositioning
          await waitForImages(containerEl);
          await new Promise((r) => requestAnimationFrame(r));

          const canvas = await toCanvas(containerEl, {
            pixelRatio: 1,
            cacheBust: true,
            backgroundColor: '#f9fafb',
            filter: (node: Node) => {
              if (node instanceof HTMLElement) {
                if (node.classList?.contains('z-40') || node.classList?.contains('z-50')) return false;
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
