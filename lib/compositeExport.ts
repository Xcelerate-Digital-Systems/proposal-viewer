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

// ── Re-export shared types so callers don't need to reach into lib/export/ ──
export type {
  CompositeExportOptions,
  BaseTextPage,
  MemberBadgeMap,
  BgImageCtx,
  DominantPageSize,
} from './export/types';

import type { CompositeExportOptions, BgImageCtx } from './export/types';
import { A4_WIDTH, A4_HEIGHT } from './export/types';
import {
  detectDominantPageSize,
  resolvePageOrientation,
  resolveDirectOrientation,
  resolvePageDimensions,
} from './export/pdfGeometry';
import { preloadImageAsDataUrl, captureAndAddPage } from './export/captureHelpers';
import { resolveCoverData, loadPerPageDocs, prefetchMemberBadgeData } from './export/coverHelpers';

/* ——— Main export function ——————————————————————————————————————————— */

export async function exportCompositePdf(opts: CompositeExportOptions): Promise<Blob> {
  const {
    pdfUrl,
    pageUrls = [],
    title,
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
    clientLogoUrl,
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

  // Suppress unused-variable lint — title is kept in opts for filename use by callers
  void title;

  const isPerPage = pageUrls.length > 0;

  // ── Load source PDF(s) ────────────────────────────────────────────────────
  // Per-page mode: load all individual page PDFs in parallel.
  // Legacy mode: load the single merged PDF.
  let srcDoc: PDFDocument | null = null;
  let perPageDocs: Map<number, PDFDocument> = new Map();

  if (isPerPage) {
    perPageDocs = await loadPerPageDocs(pageUrls);
    const firstDoc = perPageDocs.get(1);
    if (firstDoc) srcDoc = firstDoc;
  } else {
    if (!pdfUrl) throw new Error('exportCompositePdf: pdfUrl is required when pageUrls is empty');
    const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
    srcDoc = await PDFDocument.load(pdfBytes);
  }

  const dominant = srcDoc
    ? detectDominantPageSize(srcDoc)
    : { width: A4_WIDTH, height: A4_HEIGHT, orientation: 'portrait' as const };

  const outDoc = await PDFDocument.create();
  const bgPrimary = branding.bg_primary || '#0f0f0f';

  // ── Pre-load assets ───────────────────────────────────────────────────────

  // 1. Background image — pre-loaded as data URL so overlay opacity applies correctly
  let bgImageCtx: BgImageCtx | null = null;
  if (branding.bg_image_url) {
    const dataUrl = await preloadImageAsDataUrl(branding.bg_image_url);
    if (dataUrl) bgImageCtx = { branding, dataUrl };
  }

  // 2. Client logo — convert signed URL to data URL (signed URLs expire mid-export)
  let clientLogoDataUrl: string | null = null;
  if (clientLogoUrl) {
    clientLogoDataUrl = await preloadImageAsDataUrl(clientLogoUrl);
  }

  // 3. Member badge data — MemberBadge uses useEffect+fetch which won't resolve
  //    before html2canvas fires; pre-fetch here and pass as static prop instead
  const allTextPageIds: string[] = [];
  for (let vp = 1; vp <= numPages; vp++) {
    if (isTextPage(vp)) {
      const id = getTextPageId(vp);
      if (id) allTextPageIds.push(id);
    }
  }
  const memberBadgeData = await prefetchMemberBadgeData(
    allTextPageIds,
    getTextPage as (id: string) => { show_member_badge?: boolean; prepared_by_member_id?: string | null } | undefined,
  );

  // ── Cover page ───────────────────────────────────────────────────────────
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

  // ── Content pages ────────────────────────────────────────────────────────
  for (let vp = 1; vp <= numPages; vp++) {
    onProgress?.(vp, numPages);

    if (isPricingPage(vp) && pricing) {
      const orientation = pricingOrientation
        ? resolveDirectOrientation(pricingOrientation, dominant.orientation)
        : resolvePageOrientation(vp, pageEntries, dominant.orientation);
      const [pageWidth, pageHeight] = resolvePageDimensions(orientation, dominant);
      const element = createElement(PricingPage, { pricing, branding, clientName });
      await captureAndAddPage(outDoc, element, bgPrimary, pageWidth, pageHeight, 960, bgImageCtx);

    } else if (isPackagesPage(vp)) {
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
          clientLogoUrl: clientLogoDataUrl ?? undefined,   // pre-loaded data URL — avoids signed URL expiry
          companyName,
          userName,
          proposalTitle,
          orientation,
          memberBadgeData,                     // pre-fetched — bypasses async useEffect in MemberBadge
        });
        const textBg = branding.text_page_bg_color || branding.bg_secondary || '#141414';
        // 960px matches the viewer's typical display width and Tailwind's sm/md breakpoint
        // padding (px-24). Using the default 1440 triggers lg padding (px-32) which makes
        // the content column narrower and text appear smaller in the final PDF.
        await captureAndAddPage(outDoc, element, textBg, pageWidth, pageHeight, 960, bgImageCtx);
      } else {
        outDoc.addPage([pageWidth, pageHeight]);
      }

    } else {
      // Native PDF page
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