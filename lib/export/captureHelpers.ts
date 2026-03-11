// lib/export/captureHelpers.ts
'use client';

import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { BASE_CAPTURE_WIDTH, type BgImageCtx } from './types';

/**
 * Fetch an image by URL and convert it to a base64 data URL.
 */
export async function preloadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      console.warn('[compositeExport] Failed to fetch image:', response.status, url);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.warn('[compositeExport] Failed to read image as data URL');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[compositeExport] Failed to preload image:', err);
    return null;
  }
}

/**
 * Render a React element offscreen, capture with html2canvas, then composite.
 *
 * Background strategy — canvas compositing (NOT DOM injection):
 *   1. Capture the component with backgroundColor: null (transparent).
 *      Components already render transparent outer wrappers when
 *      branding.bg_image_url is set, so the transparent pixels let
 *      the composited background show through.
 *   2. Build a final canvas: bg image fill → colour overlay → component on top.
 *
 * Why not DOM injection? html2canvas doesn't reliably capture position:absolute
 * children inside an off-screen position:fixed container. Canvas 2D compositing
 * is deterministic and always works.
 */
export async function captureComponent(
  element: React.ReactElement,
  bgColor: string,
  targetAspect: number,
  overrideCaptureWidth?: number,
  bgImage?: BgImageCtx | null,
): Promise<string> {
  const baseWidth = overrideCaptureWidth || BASE_CAPTURE_WIDTH;
  const captureWidth = Math.max(baseWidth, Math.round(baseWidth * (targetAspect / 1.0)));
  const captureHeight = Math.round(captureWidth / targetAspect);

  // ── 1. Render component offscreen ───────────────────────────────
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${captureWidth}px`;
  container.style.height = `${captureHeight}px`;
  container.style.overflow = 'hidden';
  // Always transparent — background is composited in step 2
  container.style.backgroundColor = 'transparent';
  document.body.appendChild(container);

  const root = createRoot(container);

  await new Promise<void>((resolve) => {
    root.render(
      createElement('div', {
        ref: () => resolve(),
        style: { position: 'relative', width: '100%', height: '100%' },
      }, element),
    );
  });

  // Allow fonts/images inside the component to finish rendering
  await new Promise((r) => setTimeout(r, 150));

  // Wait for any <img> elements (e.g. client logo data URLs) to fully decode.
  // React sets src synchronously but decode is async — html2canvas will miss
  // images that haven't painted yet even after the 150ms settle.
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res(); // don't block export on a broken image
            }),
    ),
  );

  // Capture with transparent background
  const componentCanvas = await html2canvas(container, {
    backgroundColor: null,
    width: captureWidth,
    scale: 2,
    useCORS: true,
    logging: false,
  });

  root.unmount();
  document.body.removeChild(container);

  // ── 2. Composite onto final canvas ──────────────────────────────
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = componentCanvas.width;
  finalCanvas.height = componentCanvas.height;
  const ctx = finalCanvas.getContext('2d')!;

  if (bgImage) {
    // Layer 1: background image stretched to fill
    const bgImg = new Image();
    await new Promise<void>((resolve) => {
      bgImg.onload = () => resolve();
      bgImg.onerror = () => resolve(); // don't block export on a broken image
      bgImg.src = bgImage.dataUrl;
    });
    ctx.drawImage(bgImg, 0, 0, finalCanvas.width, finalCanvas.height);

    // Layer 2: colour overlay at configured opacity
    const overlayOpacity = bgImage.branding.bg_image_overlay_opacity ?? 0.85;
    ctx.globalAlpha = overlayOpacity;
    ctx.fillStyle = bgImage.branding.bg_primary || '#0f0f0f';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.globalAlpha = 1.0;
  } else {
    // No bg image — fill with solid background colour
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  }

  // Layer 3: component content — transparent areas let the bg show through
  ctx.drawImage(componentCanvas, 0, 0);

  return finalCanvas.toDataURL('image/png');
}

/**
 * Capture a React element, embed into the output PDF, and add the page.
 */
export async function captureAndAddPage(
  outDoc: PDFDocument,
  element: React.ReactElement,
  bgColor: string,
  pageWidth: number,
  pageHeight: number,
  captureWidth?: number,
  bgImage?: BgImageCtx | null,
): Promise<void> {
  const targetAspect = pageWidth / pageHeight;
  const dataUrl = await captureComponent(element, bgColor, targetAspect, captureWidth, bgImage);
  const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  const pngImage = await outDoc.embedPng(pngBytes);

  const imgAspect = pngImage.width / pngImage.height;
  const fitWidth = pageWidth;
  const fitHeight = fitWidth / imgAspect;

  const page = outDoc.addPage([pageWidth, Math.max(fitHeight, pageHeight)]);
  page.drawImage(pngImage, {
    x: 0,
    y: page.getHeight() - fitHeight,
    width: fitWidth,
    height: fitHeight,
  });
}