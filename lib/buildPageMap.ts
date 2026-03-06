// lib/buildPageMap.ts

import { ProposalPricing, ProposalPackages, TocSettings } from '@/lib/supabase';
import { ProposalTextPage } from '@/hooks/useProposal';

// ─── Special page: represents a non-PDF page in the virtual sequence ───

export interface SpecialPage {
  type: 'pricing' | 'text' | 'packages' | 'toc';
  position: number;
  title: string;
  textPageId?: string;
  packagesId?: string;
  sortOrder?: number;
  indent?: number;
}

export type VirtualPage =
  | { type: 'pdf'; pdfPage: number }
  | { type: 'pricing' }
  | { type: 'packages'; packagesId: string }
  | { type: 'text'; textPageId: string }
  | { type: 'toc' };

/**
 * Virtual page mapping:
 * PDF pages and special pages (pricing, packages, text pages) are interleaved.
 * Each special page has a position:
 *  - position = -1  → appears at the end (after all PDF pages)
 *  - position = 0   → appears first (before first PDF page)
 *  - position = N   → appears after PDF page N
 *
 * The resulting virtualPage is the 1-indexed page number the user sees.
 */
export function buildPageMap(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[],
  packages: ProposalPackages[],
  tocSettings?: TocSettings | null
) {
  // Collect all special pages
  const specials: SpecialPage[] = [];

  if (pricing?.enabled) {
    specials.push({
      type: 'pricing',
      position: pricing.position,
      title: pricing.title || 'Your Investment',
    });
  }

  for (const pkg of packages) {
    if (pkg.enabled) {
      specials.push({
        type: 'packages',
        position: pkg.position,
        title: pkg.title || 'Packages',
        packagesId: pkg.id,
        sortOrder: pkg.sort_order ?? 0,
        indent: pkg.indent ?? 0,
      });
    }
  }

  if (tocSettings?.enabled) {
    specials.push({
      type: 'toc',
      position: tocSettings.position,
      title: tocSettings.title || 'Table of Contents',
    });
  }

  for (const tp of textPages) {
    if (tp.enabled) {
      specials.push({
        type: 'text',
        position: tp.position,
        title: tp.title || 'Text Page',
        textPageId: tp.id,
        sortOrder: tp.sort_order,
      });
    }
  }

  if (specials.length === 0 || pdfPageCount === 0) {
    return {
      totalPages: pdfPageCount,
      pageSequence: [] as VirtualPage[],
      isPricingPage: (_vp: number) => false,
      isPackagesPage: (_vp: number) => false,
      getPackagesId: (_vp: number): string | null => null,
      isTocPage: (_vp: number) => false,
      isTextPage: (_vp: number) => false,
      getTextPageId: (_vp: number): string | null => null,
      toPdfPage: (vp: number) => vp,
    };
  }

  const sequence: VirtualPage[] = [];

  const positioned = specials.filter((s) => s.position >= 0);
  const trailing = specials.filter((s) => s.position === -1);

  // Sort positioned by position, then type order, then sortOrder.
  // Type order mirrors PageEditor's splice insertion order:
  // text=0, packages=1, toc=2, pricing=3
  const positionedTypeOrder = (type: string) => {
    if (type === 'text') return 0;
    if (type === 'packages') return 1;
    if (type === 'toc') return 2;
    return 3; // pricing
  };

  positioned.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const ta = positionedTypeOrder(a.type), tb = positionedTypeOrder(b.type);
    if (ta !== tb) return ta - tb;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  // Co-locate child packages (indent > 0) immediately after their nearest parent.
  const colocateChildren = (arr: SpecialPage[]): SpecialPage[] => {
    const result: SpecialPage[] = [];
    for (const sp of arr) {
      if (sp.type === 'packages' && (sp.indent ?? 0) > 0) {
        let insertAt = result.length;
        for (let i = result.length - 1; i >= 0; i--) {
          if (result[i].type === 'packages' && (result[i].indent ?? 0) === 0) {
            insertAt = i + 1;
            while (
              insertAt < result.length &&
              result[insertAt].type === 'packages' &&
              (result[insertAt].indent ?? 0) > 0
            ) {
              insertAt++;
            }
            break;
          }
        }
        result.splice(insertAt, 0, sp);
      } else {
        result.push(sp);
      }
    }
    return result;
  };

  const positionedFinal = colocateChildren(positioned);
  const trailingFinal = colocateChildren(trailing);

  // Build sequence: interleave PDF pages with positioned specials
  let posIdx = 0;
  for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
    while (posIdx < positionedFinal.length && positionedFinal[posIdx].position < pdfPage) {
      const sp = positionedFinal[posIdx];
      if (sp.type === 'pricing') {
        sequence.push({ type: 'pricing' });
      } else if (sp.type === 'packages') {
        sequence.push({ type: 'packages', packagesId: sp.packagesId! });
      } else if (sp.type === 'toc') {
        sequence.push({ type: 'toc' });
      } else {
        sequence.push({ type: 'text', textPageId: sp.textPageId! });
      }
      posIdx++;
    }
    sequence.push({ type: 'pdf', pdfPage });
  }

  // Insert remaining positioned specials (position >= pdfPageCount)
  while (posIdx < positionedFinal.length) {
    const sp = positionedFinal[posIdx];
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else if (sp.type === 'packages') {
      sequence.push({ type: 'packages', packagesId: sp.packagesId! });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
    posIdx++;
  }

  // Add trailing specials
  trailingFinal.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailingFinal) {
    if (sp.type === 'pricing') {
      sequence.push({ type: 'pricing' });
    } else if (sp.type === 'packages') {
      sequence.push({ type: 'packages', packagesId: sp.packagesId! });
    } else {
      sequence.push({ type: 'text', textPageId: sp.textPageId! });
    }
  }

  const totalPages = sequence.length;

  const isPricingPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'pricing';
  };

  const isPackagesPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'packages';
  };

  const isTocPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'toc';
  };

  const isTextPage = (vp: number) => {
    const idx = vp - 1;
    return idx >= 0 && idx < sequence.length && sequence[idx].type === 'text';
  };

  const getPackagesId = (vp: number): string | null => {
    const idx = vp - 1;
    if (idx >= 0 && idx < sequence.length && sequence[idx].type === 'packages') {
      return (sequence[idx] as { type: 'packages'; packagesId: string }).packagesId;
    }
    return null;
  };

  const getTextPageId = (vp: number): string | null => {
    const idx = vp - 1;
    if (idx >= 0 && idx < sequence.length && sequence[idx].type === 'text') {
      return (sequence[idx] as { type: 'text'; textPageId: string }).textPageId;
    }
    return null;
  };

  const toPdfPage = (vp: number): number => {
    const idx = vp - 1;
    if (idx < 0 || idx >= sequence.length) return -1;
    const entry = sequence[idx];
    if (entry.type === 'pdf') return entry.pdfPage;
    return -1;
  };

  return {
    totalPages,
    pageSequence: sequence,
    isPricingPage,
    isPackagesPage,
    getPackagesId,
    isTocPage,
    isTextPage,
    getTextPageId,
    toPdfPage,
  };
}