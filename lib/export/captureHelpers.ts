// lib/export/captureHelpers.ts
'use client';

import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import type { CompanyBranding } from '@/hooks/useProposal';
import { BASE_CAPTURE_WIDTH, type BgImageCtx } from './types';

/**
 * Fetch an image by URL and convert it to a base64 data URL.
 */
export async function preloadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      console.warn('[compositeExport] Failed to fetch background image:', response.status, url);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.warn('[compositeExport] Failed to read background image as data URL');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[compositeExport] Failed to preload background image:', err);
    return null;
  }
}

/**
 * Inject background image + overlay layers into a container element.
 */
export function injectBackgroundLayers(
  container: HTMLElement,
  branding: CompanyBranding,
  dataUrl: string,
): void {
  const imgEl = document.createElement('img');
  imgEl.src = dataUrl;
  imgEl.style.position = 'absolute';
  imgEl.style.top = '0';
  imgEl.style.left = '0';
  imgEl.style.width = '100%';
  imgEl.style.height = '100%';
  imgEl.style.objectFit = 'cover';
  imgEl.style.objectPosition = 'center';
  imgEl.style.pointerEvents = 'none';
  container.appendChild(imgEl);

  const overlayLayer = document.createElement('div');
  overlayLayer.style.position = 'absolute';
  overlayLayer.style.top = '0';
  overlayLayer.style.left = '0';
  overlayLayer.style.width = '100%';
  overlayLayer.style.height = '100%';
  overlayLayer.style.backgroundColor = branding.bg_primary || '#0f0f0f';
  overlayLayer.style.opacity = String(branding.bg_image_overlay_opacity ?? 0.85);
  overlayLayer.style.pointerEvents = 'none';
  container.appendChild(overlayLayer);
}

/**
 * Render a React element offscreen, capture with html2canvas, clean up.
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

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${captureWidth}px`;
  container.style.height = `${captureHeight}px`;
  container.style.overflow = 'hidden';
  container.style.backgroundColor = bgColor;
  document.body.appendChild(container);

  if (bgImage) {
    injectBackgroundLayers(container, bgImage.branding, bgImage.dataUrl);
  }

  const root = createRoot(container);

  await new Promise<void>((resolve) => {
    root.render(
      createElement('div', {
        ref: () => resolve(),
        style: { position: 'relative', width: '100%', height: '100%' },
      }, element),
    );
  });

  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(container, {
    backgroundColor: bgColor,
    width: captureWidth,
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png');

  root.unmount();
  document.body.removeChild(container);

  return dataUrl;
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