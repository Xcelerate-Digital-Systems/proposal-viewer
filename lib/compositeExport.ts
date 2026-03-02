// lib/compositeExport.ts
'use client';

import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import TextPage from '@/components/viewer/TextPage';
import PricingPage from '@/components/viewer/PricingPage';
import type { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import type { ProposalPricing, PageNameEntry } from '@/lib/supabase';

/* ——— Types ———————————————————————————————————————————————— */

/** Base text page shape — works for both ProposalTextPage and DocumentTextPage */
interface BaseTextPage {
  id: string;
  enabled: boolean;
  position: number;
  title: string;
  content: unknown;
  sort_order: number;
}

export interface CompositeExportOptions {
  pdfUrl: string;
  title: string;
  numPages: number;
  isPricingPage: (vp: number) => boolean;
  isTextPage: (vp: number) => boolean;
  getTextPageId: (vp: number) => string | null;
  toPdfPage: (vp: number) => number;
  getTextPage: (id: string) => BaseTextPage | undefined;
  pricing: ProposalPricing | null;
  branding: CompanyBranding;
  clientName?: string;
  companyName?: string;
  userName?: string;
  proposalTitle?: string;
  onProgress?: (current: number, total: number) => void;
  /** Page entries for per-page orientation overrides */
  pageEntries?: PageNameEntry[];
}

/* ——— Helpers ———————————————————————————————————————————— */

// A4 fallback dimensions in PDF points (72 pts/inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Base capture width for html2canvas (px) — wider = sharper
const BASE_CAPTURE_WIDTH = 1440;

/**
 * Analyse the source PDF to determine the dominant page dimensions.
 * Returns the actual width/height (in PDF points) and orientation
 * of the most common page size. This ensures rendered pages match
 * the real slide/page size rather than assuming A4.
 */
function detectDominantPageSize(srcDoc: PDFDocument): {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
} {
  if (srcDoc.getPageCount() === 0) {
    return { width: A4_WIDTH, height: A4_HEIGHT, orientation: 'portrait' };
  }

  // Count occurrences of each rounded page size
  const sizeCounts = new Map<string, { width: number; height: number; count: number }>();

  for (let i = 0; i < srcDoc.getPageCount(); i++) {
    const page = srcDoc.getPage(i);
    const { width, height } = page.getSize();
    // Round to avoid floating-point noise
    const key = `${Math.round(width)}x${Math.round(height)}`;
    const existing = sizeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      sizeCounts.set(key, { width, height, count: 1 });
    }
  }

  // Pick the most common page size
  let dominant = { width: A4_WIDTH, height: A4_HEIGHT, count: 0 };
  for (const entry of Array.from(sizeCounts.values())) {
    if (entry.count > dominant.count) {
      dominant = entry;
    }
  }

  return {
    width: dominant.width,
    height: dominant.height,
    orientation: dominant.width > dominant.height ? 'landscape' : 'portrait',
  };
}

/**
 * Resolve the effective orientation for a virtual page.
 * Priority: manual override on page entry > dominant PDF orientation.
 */
function resolvePageOrientation(
  vp: number,
  pageEntries: PageNameEntry[] | undefined,
  dominantOrientation: 'portrait' | 'landscape',
): 'portrait' | 'landscape' {
  if (pageEntries) {
    let count = 0;
    for (const entry of pageEntries) {
      if (entry.type === 'group') continue;
      count++;
      if (count === vp && entry.orientation && entry.orientation !== 'auto') {
        return entry.orientation;
      }
    }
  }
  return dominantOrientation;
}

/**
 * Render a React element into an offscreen container, capture it with
 * html2canvas, then clean up. Returns a PNG data URL.
 *
 * The capture width is scaled to match the target page aspect ratio
 * so the rendered content fills the full page width.
 */
async function captureComponent(
  element: React.ReactElement,
  bgColor: string,
  targetAspect: number, // width / height of the target PDF page
): Promise<string> {
  // Use a wide capture; the aspect ratio of the target page determines
  // how the content is laid out — wider pages get wider containers.
  const captureWidth = Math.max(BASE_CAPTURE_WIDTH, Math.round(BASE_CAPTURE_WIDTH * (targetAspect / 1.0)));

  // Create offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${captureWidth}px`;
  container.style.minHeight = '100px';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = bgColor;
  document.body.appendChild(container);

  // Render React component
  const root = createRoot(container);

  await new Promise<void>((resolve) => {
    root.render(createElement('div', { ref: () => resolve() }, element));
  });

  // Extra tick for styles/layout to settle
  await new Promise((r) => setTimeout(r, 100));

  // Capture with html2canvas
  const canvas = await html2canvas(container, {
    backgroundColor: bgColor,
    width: captureWidth,
    scale: 2, // 2x for sharpness
    useCORS: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png');

  // Cleanup
  root.unmount();
  document.body.removeChild(container);

  return dataUrl;
}

/* ——— Main export function ——————————————————————————————— */

export async function exportCompositePdf(opts: CompositeExportOptions): Promise<Blob> {
  const {
    pdfUrl,
    title,
    numPages,
    isPricingPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
    getTextPage,
    pricing,
    branding,
    clientName,
    companyName,
    userName,
    proposalTitle,
    onProgress,
    pageEntries,
  } = opts;

  // Load the source PDF
  const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
  const srcDoc = await PDFDocument.load(pdfBytes);

  // Detect dominant page size from source PDF (actual dimensions, not A4)
  const dominant = detectDominantPageSize(srcDoc);

  // Create the output PDF
  const outDoc = await PDFDocument.create();

  const bgPrimary = branding.bg_primary || '#0f0f0f';

  for (let vp = 1; vp <= numPages; vp++) {
    onProgress?.(vp, numPages);

    if (isPricingPage(vp) && pricing) {
      // —— Capture pricing page ——————————————————————————————————
      const orientation = resolvePageOrientation(vp, pageEntries, dominant.orientation);

      // Use actual source PDF dimensions, swapping if orientation differs
      let pageWidth: number;
      let pageHeight: number;
      if (orientation === dominant.orientation) {
        pageWidth = dominant.width;
        pageHeight = dominant.height;
      } else {
        // Manual override flipped the orientation — swap dimensions
        pageWidth = dominant.height;
        pageHeight = dominant.width;
      }

      const targetAspect = pageWidth / pageHeight;

      const element = createElement(PricingPage, {
        pricing,
        branding,
        clientName,
      });

      const dataUrl = await captureComponent(element, bgPrimary, targetAspect);
      const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
      const pngImage = await outDoc.embedPng(pngBytes);

      // Scale image to fill page width, preserving aspect ratio
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

    } else if (isTextPage(vp)) {
      // —— Capture text page —————————————————————————————————————
      const orientation = resolvePageOrientation(vp, pageEntries, dominant.orientation);

      let pageWidth: number;
      let pageHeight: number;
      if (orientation === dominant.orientation) {
        pageWidth = dominant.width;
        pageHeight = dominant.height;
      } else {
        pageWidth = dominant.height;
        pageHeight = dominant.width;
      }

      const targetAspect = pageWidth / pageHeight;

      const textPageId = getTextPageId(vp);
      const textPage = textPageId ? getTextPage(textPageId) : undefined;

      if (textPage) {
        const element = createElement(TextPage, {
          textPage: textPage as ProposalTextPage,
          branding,
          clientName,
          companyName,
          userName,
          proposalTitle,
        });

        const textBg = branding.text_page_bg_color || branding.bg_secondary || '#141414';
        const dataUrl = await captureComponent(element, textBg, targetAspect);
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
      } else {
        // Fallback: empty page matching dominant size
        outDoc.addPage([pageWidth, pageHeight]);
      }

    } else {
      // —— Copy PDF page ———————————————————————————————————————
      const pdfPage = toPdfPage(vp);
      if (pdfPage > 0 && pdfPage <= srcDoc.getPageCount()) {
        const [copiedPage] = await outDoc.copyPages(srcDoc, [pdfPage - 1]);
        outDoc.addPage(copiedPage);
      } else {
        outDoc.addPage([dominant.width, dominant.height]);
      }
    }
  }

  const resultBytes = await outDoc.save();
  return new Blob([resultBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
}