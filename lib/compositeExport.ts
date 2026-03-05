// lib/compositeExport.ts
'use client';

import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import TextPage from '@/components/viewer/TextPage';
import PricingPage from '@/components/viewer/PricingPage';
import PackagesPage from '@/components/viewer/PackagesPage';
import TocPage, { PageSequenceEntry } from '@/components/viewer/TocPage';
import CoverPage from '@/components/viewer/CoverPage';
import type { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import type { Proposal, ProposalPricing, ProposalPackages, PageNameEntry, TocSettings } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

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
  isPackagesPage: (vp: number) => boolean;
  isTextPage: (vp: number) => boolean;
  getTextPageId: (vp: number) => string | null;
  toPdfPage: (vp: number) => number;
  getTextPage: (id: string) => BaseTextPage | undefined;
  pricing: ProposalPricing | null;
  packages: ProposalPackages[];
  getPackagesId: (vp: number) => string | null;
  branding: CompanyBranding;
  clientName?: string;
  companyName?: string;
  userName?: string;
  proposalTitle?: string;
  onProgress?: (current: number, total: number) => void;
  pageEntries?: PageNameEntry[];
  pricingOrientation?: 'auto' | 'portrait' | 'landscape';
  textPageOrientations?: Record<string, 'auto' | 'portrait' | 'landscape'>;
  proposal?: Proposal | null;
  includeCover?: boolean;
  isTocPage?: (vp: number) => boolean;
  tocSettings?: TocSettings | null;
  pageSequence?: Array<{ type: string; pdfPage?: number; textPageId?: string }>;
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
 * Resolve orientation from a direct override value.
 * Returns the override if set (and not 'auto'), otherwise the dominant orientation.
 */
function resolveDirectOrientation(
  override: 'auto' | 'portrait' | 'landscape' | undefined,
  dominantOrientation: 'portrait' | 'landscape',
): 'portrait' | 'landscape' {
  if (override && override !== 'auto') {
    return override;
  }
  return dominantOrientation;
}

/**
 * Resolve page dimensions based on orientation relative to the dominant PDF size.
 * Returns [pageWidth, pageHeight].
 */
function resolvePageDimensions(
  orientation: 'portrait' | 'landscape',
  dominant: { width: number; height: number; orientation: 'portrait' | 'landscape' },
): [number, number] {
  if (orientation === dominant.orientation) {
    return [dominant.width, dominant.height];
  }
  // Orientation flipped — swap dimensions
  return [dominant.height, dominant.width];
}

/**
 * Fetch an image by URL, convert it to a base64 data URL.
 * Using a data URL completely sidesteps CORS issues during html2canvas
 * capture — the pixel data is already inline so no network request is
 * needed at capture time.
 *
 * Returns the data URL string, or null on failure.
 */
async function preloadImageAsDataUrl(url: string): Promise<string | null> {
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
 * Uses an actual <img> tag with a base64 data URL src (not a remote URL)
 * so html2canvas doesn't need to make any network requests during capture.
 * object-fit: cover replicates CSS background-size: cover behaviour.
 *
 * This mirrors what ViewerBackground renders in the live viewer:
 *   1. Full-bleed background image (cover, centered)
 *   2. Colour overlay with configurable opacity
 */
function injectBackgroundLayers(
  container: HTMLElement,
  branding: CompanyBranding,
  dataUrl: string,
): void {
  // Background image layer — use an <img> with the base64 data URL.
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

  // Colour overlay layer
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

/** Context object passed through to captureComponent for background rendering */
type BgImageCtx = { branding: CompanyBranding; dataUrl: string };

/**
 * Render a React element into an offscreen container, capture it with
 * html2canvas, then clean up. Returns a PNG data URL.
 *
 * The container is sized to match the target page aspect ratio so
 * components using min-h-full / flex centering render correctly.
 *
 * When bgImage is provided, the background image + overlay are injected
 * as DOM layers directly into the container — no extra React wrapper
 * divs that could break the flex height chain.
 */
async function captureComponent(
  element: React.ReactElement,
  bgColor: string,
  targetAspect: number,
  overrideCaptureWidth?: number,
  bgImage?: BgImageCtx | null,
): Promise<string> {
  const baseWidth = overrideCaptureWidth || BASE_CAPTURE_WIDTH;
  const captureWidth = Math.max(baseWidth, Math.round(baseWidth * (targetAspect / 1.0)));
  const captureHeight = Math.round(captureWidth / targetAspect);

  // Create offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${captureWidth}px`;
  container.style.height = `${captureHeight}px`;
  container.style.overflow = 'hidden';
  container.style.backgroundColor = bgColor;
  document.body.appendChild(container);

  // Inject background image + overlay as DOM layers (before React content).
  // These are absolutely positioned so they sit behind the content without
  // adding any wrapper divs that could interfere with flex centering.
  if (bgImage) {
    injectBackgroundLayers(container, bgImage.branding, bgImage.dataUrl);
  }

  // Render React component — sits above bg layers via DOM order.
  // The wrapper div gets position: relative for z-stacking and
  // height: 100% so that child min-h-full / items-center resolves
  // against the full container height.
  const root = createRoot(container);

  await new Promise<void>((resolve) => {
    root.render(
      createElement('div', {
        ref: () => resolve(),
        style: { position: 'relative', width: '100%', height: '100%' },
      }, element),
    );
  });

  // Extra tick for styles/layout to settle
  await new Promise((r) => setTimeout(r, 100));

  // Capture with html2canvas
  const canvas = await html2canvas(container, {
    backgroundColor: bgColor,
    width: captureWidth,
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png');

  // Cleanup
  root.unmount();
  document.body.removeChild(container);

  return dataUrl;
}

/**
 * Capture a React element, embed into the output PDF, and add the page.
 * Shared logic for cover, pricing, packages, text, and TOC pages.
 */
async function captureAndAddPage(
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
}

/* ——— Cover page helpers ————————————————————————————————— */

/**
 * Get a signed URL from Supabase storage. Returns null on failure.
 */
async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

/**
 * Pre-fetch all signed URLs and resolved member data needed for
 * the cover page so they're available synchronously during render.
 */
async function resolveCoverData(proposal: Proposal): Promise<{
  bgUrl: string | null;
  clientLogoUrl: string | null;
  avatarUrl: string | null;
  preparedByName: string | null;
}> {
  let bgUrl: string | null = null;
  let clientLogoUrl: string | null = null;
  let avatarUrl: string | null = null;
  let preparedByName: string | null = proposal.prepared_by || null;

  // Fetch cover image
  if (proposal.cover_image_path) {
    bgUrl = await getSignedUrl('proposals', proposal.cover_image_path);
  }

  // Fetch client logo
  if (proposal.cover_client_logo_path && (proposal.cover_show_client_logo ?? false)) {
    clientLogoUrl = await getSignedUrl('proposals', proposal.cover_client_logo_path);
  }

  // Fetch avatar (direct path first)
  if (proposal.cover_avatar_path && (proposal.cover_show_avatar ?? false)) {
    avatarUrl = await getSignedUrl('proposals', proposal.cover_avatar_path);
  }

  // Resolve member data if needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberId = (proposal as any).prepared_by_member_id;
  if (memberId) {
    const needsName = !proposal.prepared_by;
    const needsAvatar = !proposal.cover_avatar_path && (proposal.cover_show_avatar ?? false);

    if (needsName || needsAvatar) {
      try {
        const { data } = await supabase
          .from('team_members')
          .select('name, avatar_path')
          .eq('id', memberId)
          .single();

        if (data) {
          if (needsName && data.name) {
            preparedByName = data.name;
          }
          if (needsAvatar && data.avatar_path) {
            avatarUrl = await getSignedUrl('proposals', data.avatar_path);
          }
        }
      } catch {
        // Member not found — continue without
      }
    }
  }

  return { bgUrl, clientLogoUrl, avatarUrl, preparedByName };
}

/* ——— Main export function ——————————————————————————————— */

export async function exportCompositePdf(opts: CompositeExportOptions): Promise<Blob> {
  const {
    pdfUrl,
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

  // Load the source PDF
  const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
  const srcDoc = await PDFDocument.load(pdfBytes);

  // Detect dominant page size from source PDF (actual dimensions, not A4)
  const dominant = detectDominantPageSize(srcDoc);

  // Create the output PDF
  const outDoc = await PDFDocument.create();

  const bgPrimary = branding.bg_primary || '#0f0f0f';

  // ── Pre-load the background image as a base64 data URL ─────────
  // html2canvas cannot reliably capture remote images (even with
  // useCORS / crossOrigin). Converting to a data URL up front means
  // the pixel data is inline — no network request at capture time.
  let bgImageCtx: BgImageCtx | null = null;
  if (branding.bg_image_url) {
    const dataUrl = await preloadImageAsDataUrl(branding.bg_image_url);
    if (dataUrl) {
      bgImageCtx = { branding, dataUrl };
    }
  }

  // ── Cover page (page 1) ────────────────────────────────────────
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

    // Cover handles its own background — no bgImageCtx needed
    await captureAndAddPage(outDoc, coverElement, bgPrimary, dominant.width, dominant.height, 960);
  }

  // ── Content pages ──────────────────────────────────────────────
  for (let vp = 1; vp <= numPages; vp++) {
    onProgress?.(vp, numPages);

    if (isPricingPage(vp) && pricing) {
      // —— Capture pricing page ——————————————————————————————————
      const orientation = pricingOrientation
        ? resolveDirectOrientation(pricingOrientation, dominant.orientation)
        : resolvePageOrientation(vp, pageEntries, dominant.orientation);

      const [pageWidth, pageHeight] = resolvePageDimensions(orientation, dominant);

      const element = createElement(PricingPage, {
        pricing,
        branding,
        clientName,
      });

      await captureAndAddPage(outDoc, element, bgPrimary, pageWidth, pageHeight, 960, bgImageCtx);

    } else if (isPackagesPage(vp)) {
      // —— Capture packages page —————————————————————————————————
      const pkgId = getPackagesId(vp);
      const pkg = pkgId ? packages.find((p) => p.id === pkgId) : undefined;
      if (pkg) {
        const orientation = pricingOrientation
          ? resolveDirectOrientation(pricingOrientation, dominant.orientation)
          : resolvePageOrientation(vp, pageEntries, dominant.orientation);

        const [pageWidth, pageHeight] = resolvePageDimensions(orientation, dominant);

        const element = createElement(PackagesPage, {
          packages: pkg,
          branding,
          clientName,
        });

        await captureAndAddPage(outDoc, element, bgPrimary, pageWidth, pageHeight, 960, bgImageCtx);
      } else {
        outDoc.addPage([dominant.width, dominant.height]);
      }

    } else if (isTocPage?.(vp) && tocSettings) {
      // —— Capture TOC page ——————————————————————————————————————
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
      // —— Capture text page —————————————————————————————————————
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