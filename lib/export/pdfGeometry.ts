// lib/export/pdfGeometry.ts

import { PDFDocument } from 'pdf-lib';
import type { PageNameEntry } from '@/lib/supabase';
import { A4_WIDTH, A4_HEIGHT, type DominantPageSize } from './types';

/**
 * Analyse the source PDF to determine the dominant page dimensions.
 * Returns the actual width/height (in PDF points) and orientation
 * of the most common page size. This ensures rendered pages match
 * the real slide/page size rather than assuming A4.
 */
export function detectDominantPageSize(srcDoc: PDFDocument): DominantPageSize {
  if (srcDoc.getPageCount() === 0) {
    return { width: A4_WIDTH, height: A4_HEIGHT, orientation: 'portrait' };
  }

  const sizeCounts = new Map<string, { width: number; height: number; count: number }>();

  for (let i = 0; i < srcDoc.getPageCount(); i++) {
    const page = srcDoc.getPage(i);
    const { width, height } = page.getSize();
    const key = `${Math.round(width)}x${Math.round(height)}`;
    const existing = sizeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      sizeCounts.set(key, { width, height, count: 1 });
    }
  }

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
export function resolvePageOrientation(
  vp: number,
  pageEntries: PageNameEntry[] | undefined,
  dominantOrientation: 'portrait' | 'landscape',
): 'portrait' | 'landscape' {
  if (pageEntries) {
    let count = 0;
    for (const entry of pageEntries) {
      if (entry.type === 'group') continue;
      count++;
      if (count === vp && entry.orientation) {
        return entry.orientation;
      }
    }
  }
  return dominantOrientation;
}

/**
 * Resolve orientation from a direct override value.
 */
export function resolveDirectOrientation(
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
export function resolvePageDimensions(
  orientation: 'portrait' | 'landscape',
  dominant: DominantPageSize,
): [number, number] {
  if (orientation === dominant.orientation) {
    return [dominant.width, dominant.height];
  }
  return [dominant.height, dominant.width];
}