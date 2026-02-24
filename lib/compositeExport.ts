// lib/compositeExport.ts
'use client';

import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import TextPage from '@/components/viewer/TextPage';
import PricingPage from '@/components/viewer/PricingPage';
import type { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import type { ProposalPricing } from '@/lib/supabase';

/* ─── Types ────────────────────────────────────────────────────────── */

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
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

// A4 dimensions in PDF points (72 pts/inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
// Render width for html2canvas capture (px) — wider = sharper
const CAPTURE_WIDTH = 1024;

/**
 * Render a React element into an offscreen container, capture it with
 * html2canvas, then clean up. Returns a PNG data URL.
 */
async function captureComponent(
  element: React.ReactElement,
  bgColor: string,
): Promise<string> {
  // Create offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${CAPTURE_WIDTH}px`;
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
    width: CAPTURE_WIDTH,
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

/* ─── Main export function ─────────────────────────────────────────── */

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
  } = opts;

  // Load the source PDF
  const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
  const srcDoc = await PDFDocument.load(pdfBytes);

  // Create the output PDF
  const outDoc = await PDFDocument.create();

  const bgPrimary = branding.bg_primary || '#0f0f0f';

  for (let vp = 1; vp <= numPages; vp++) {
    onProgress?.(vp, numPages);

    if (isPricingPage(vp) && pricing) {
      // ── Capture pricing page ──────────────────────────────────
      const element = createElement(PricingPage, {
        pricing,
        branding,
        clientName,
      });

      const dataUrl = await captureComponent(element, bgPrimary);
      const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
      const pngImage = await outDoc.embedPng(pngBytes);

      // Scale image to fit A4 while preserving aspect ratio
      const imgAspect = pngImage.width / pngImage.height;
      const pageWidth = A4_WIDTH;
      const pageHeight = pageWidth / imgAspect;

      const page = outDoc.addPage([pageWidth, Math.max(pageHeight, A4_HEIGHT)]);
      page.drawImage(pngImage, {
        x: 0,
        y: page.getHeight() - pageHeight,
        width: pageWidth,
        height: pageHeight,
      });

    } else if (isTextPage(vp)) {
      // ── Capture text page ─────────────────────────────────────
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
        const dataUrl = await captureComponent(element, textBg);
        const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
        const pngImage = await outDoc.embedPng(pngBytes);

        const imgAspect = pngImage.width / pngImage.height;
        const pageWidth = A4_WIDTH;
        const pageHeight = pageWidth / imgAspect;

        const page = outDoc.addPage([pageWidth, Math.max(pageHeight, A4_HEIGHT)]);
        page.drawImage(pngImage, {
          x: 0,
          y: page.getHeight() - pageHeight,
          width: pageWidth,
          height: pageHeight,
        });
      } else {
        // Fallback: empty page
        outDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      }

    } else {
      // ── Copy PDF page ─────────────────────────────────────────
      const pdfPage = toPdfPage(vp);
      if (pdfPage > 0 && pdfPage <= srcDoc.getPageCount()) {
        const [copiedPage] = await outDoc.copyPages(srcDoc, [pdfPage - 1]);
        outDoc.addPage(copiedPage);
      } else {
        outDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      }
    }
  }

  const resultBytes = await outDoc.save();
  return new Blob([resultBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
}