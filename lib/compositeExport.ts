// lib/compositeExport.ts
'use client';

import { PDFDocument } from 'pdf-lib';
import { createElement } from 'react';
import TextPage from '@/components/viewer/TextPage';
import PricingPage from '@/components/viewer/PricingPage';
import PackagesPage from '@/components/viewer/PackagesPage';
import TocPage, { PageSequenceEntry } from '@/components/viewer/TocPage';
import CoverPage from '@/components/viewer/CoverPage';
import type { ProposalTextPage } from '@/hooks/useProposal';

import { A4_WIDTH, A4_HEIGHT, type CompositeExportOptions } from './export/types';
import { detectDominantPageSize, resolvePageOrientation, resolveDirectOrientation, resolvePageDimensions } from './export/pdfGeometry';
import { preloadImageAsDataUrl, captureAndAddPage } from './export/captureHelpers';
import { resolveCoverData, loadPerPageDocs } from './export/coverHelpers';

// Re-export types so existing call-sites importing from here still work
export type { CompositeExportOptions, BaseTextPage } from './export/types';

/* ——— Main export function ——————————————————————————————— */

export async function exportCompositePdf(opts: CompositeExportOptions): Promise<Blob> {
  const {
    pdfUrl,
    pageUrls = [],
    numPages,
    isPricingPage,
    isPackagesPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
    getTextPage,
    pricing,
    packages,
    getPackagesId,
    branding,
    clientName,
    companyName,
    userName,
    proposalTitle,
    onProgress,
    pageEntries,
    pricingOrientation,
    textPageOrientations,
    proposal,
    includeCover,
    isTocPage,
    tocSettings,
    pageSequence,
  } = opts;

  const isPerPage = pageUrls.length > 0;

  // ── Load source PDF(s) ─────────────────────────────────────────
  let srcDoc: PDFDocument | null = null;
  let perPageDocs: Map<number, PDFDocument> = new Map();

  if (isPerPage) {
    perPageDocs = await loadPerPageDocs(pageUrls);
    const firstDoc = perPageDocs.get(1);
    if (firstDoc) {
      srcDoc = firstDoc; // used only for detectDominantPageSize
    }
  } else {
    if (!pdfUrl) {
      throw new Error('exportCompositePdf: pdfUrl is required when pageUrls is empty');
    }
    const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
    srcDoc = await PDFDocument.load(pdfBytes);
  }

  // ── Detect dominant page size ──────────────────────────────────
  const dominant = srcDoc
    ? detectDominantPageSize(srcDoc)
    : { width: A4_WIDTH, height: A4_HEIGHT, orientation: 'portrait' as const };

  const outDoc = await PDFDocument.create();
  const bgPrimary = branding.bg_primary || '#0f0f0f';

  // ── Pre-load background image ──────────────────────────────────
  let bgImageCtx = null;
  if (branding.bg_image_url) {
    const dataUrl = await preloadImageAsDataUrl(branding.bg_image_url);
    if (dataUrl) {
      bgImageCtx = { branding, dataUrl };
    }
  }

  // ── Cover page ─────────────────────────────────────────────────
  if (includeCover && proposal) {
    const coverData = await resolveCoverData(proposal);

    const coverElement = createElement(CoverPage, {
      proposal,
      branding,
      onStart: () => {},
      hideButton: true,
      resolvedBgUrl: coverData.bgUrl,
      resolvedClientLogoUrl: coverData.clientLogoUrl,
      resolvedAvatarUrl: coverData.avatarUrl,
      resolvedPreparedByName: coverData.preparedByName,
    });

    await captureAndAddPage(outDoc, coverElement, bgPrimary, dominant.width, dominant.height, 960);
  }

  // ── Content pages ──────────────────────────────────────────────
  for (let vp = 1; vp <= numPages; vp++) {
    onProgress?.(vp, numPages);

    if (isPricingPage(vp) && pricing) {
      // —— Pricing page ————————————————————————————————————————
      const orientation = pricingOrientation
        ? resolveDirectOrientation(pricingOrientation, dominant.orientation)
        : resolvePageOrientation(vp, pageEntries, dominant.orientation);
      const [pageWidth, pageHeight] = resolvePageDimensions(orientation, dominant);

      const element = createElement(PricingPage, { pricing, branding, clientName });
      await captureAndAddPage(outDoc, element, bgPrimary, pageWidth, pageHeight, 960, bgImageCtx);

    } else if (isPackagesPage(vp)) {
      // —— Packages page ———————————————————————————————————————
      const pkgId = getPackagesId(vp);
      const pkg = pkgId ? packages.find((p) => p.id === pkgId) : undefined;
      if (pkg) {
        const orientation = pricingOrientation
          ? resolveDirectOrientation(pricingOrientation, dominant.orientation)
          : resolvePageOrientation(vp, pageEntries, dominant.orientation);
        const [pageWidth, pageHeight] = resolvePageDimensions(orientation, dominant);

        const element = createElement(PackagesPage, { packages: pkg, branding, clientName });
        await captureAndAddPage(outDoc, element, bgPrimary, pageWidth, pageHeight, 960, bgImageCtx);
      } else {
        outDoc.addPage([dominant.width, dominant.height]);
      }

    } else if (isTocPage?.(vp) && tocSettings) {
      // —— TOC page ————————————————————————————————————————————
      const [pageWidth, pageHeight] = resolvePageDimensions(dominant.orientation, dominant);

      const tocElement = createElement(TocPage, {
        branding,
        tocSettings,
        pageSequence: (pageSequence || []) as PageSequenceEntry[],
        pageEntries: pageEntries || [],
        numPages,
      });
      await captureAndAddPage(outDoc, tocElement, bgPrimary, pageWidth, pageHeight, 960, bgImageCtx);

    } else if (isTextPage(vp)) {
      // —— Text page ———————————————————————————————————————————
      const textPageId = getTextPageId(vp);

      let orientation: 'portrait' | 'landscape';
      if (textPageId && textPageOrientations?.[textPageId]) {
        orientation = resolveDirectOrientation(textPageOrientations[textPageId], dominant.orientation);
      } else {
        orientation = resolvePageOrientation(vp, pageEntries, dominant.orientation);
      }
      const [pageWidth, pageHeight] = resolvePageDimensions(orientation, dominant);

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
        await captureAndAddPage(outDoc, element, textBg, pageWidth, pageHeight, undefined, bgImageCtx);
      } else {
        outDoc.addPage([pageWidth, pageHeight]);
      }

    } else {
      // —— PDF page ————————————————————————————————————————————
      const pdfPage = toPdfPage(vp);

      if (isPerPage) {
        const pageDoc = perPageDocs.get(pdfPage);
        if (pageDoc && pageDoc.getPageCount() > 0) {
          const [copiedPage] = await outDoc.copyPages(pageDoc, [0]);
          outDoc.addPage(copiedPage);
        } else {
          outDoc.addPage([dominant.width, dominant.height]);
        }
      } else {
        if (srcDoc && pdfPage > 0 && pdfPage <= srcDoc.getPageCount()) {
          const [copiedPage] = await outDoc.copyPages(srcDoc, [pdfPage - 1]);
          outDoc.addPage(copiedPage);
        } else {
          outDoc.addPage([dominant.width, dominant.height]);
        }
      }
    }
  }

  const resultBytes = await outDoc.save();
  return new Blob([resultBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
}