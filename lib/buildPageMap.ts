// lib/buildPageMap.ts

import { ProposalPricing, ProposalPackages, TocSettings, PageOrderEntry } from '@/lib/supabase';
import { ProposalTextPage } from '@/hooks/useProposal';

// ─── Virtual page sequence ────────────────────────────────────────────────────

export type VirtualPage =
  | { type: 'pdf'; pdfPage: number }
  | { type: 'pricing' }
  | { type: 'packages'; packagesId: string }
  | { type: 'text'; textPageId: string }
  | { type: 'toc' };

// ─── Legacy special page (used only by fallback path) ────────────────────────

interface SpecialPage {
  type: 'pricing' | 'text' | 'packages' | 'toc';
  position: number;
  title: string;
  textPageId?: string;
  packagesId?: string;
  sortOrder?: number;
  indent?: number;
}

// ─── Shared return-value builder ──────────────────────────────────────────────

function makeResult(sequence: VirtualPage[]) {
  const totalPages = sequence.length;

  const isPricingPage = (vp: number) =>
    sequence[vp - 1]?.type === 'pricing';

  const isPackagesPage = (vp: number) =>
    sequence[vp - 1]?.type === 'packages';

  const isTocPage = (vp: number) =>
    sequence[vp - 1]?.type === 'toc';

  const isTextPage = (vp: number) =>
    sequence[vp - 1]?.type === 'text';

  const getPackagesId = (vp: number): string | null => {
    const e = sequence[vp - 1];
    return e?.type === 'packages' ? (e as { type: 'packages'; packagesId: string }).packagesId : null;
  };

  const getTextPageId = (vp: number): string | null => {
    const e = sequence[vp - 1];
    return e?.type === 'text' ? (e as { type: 'text'; textPageId: string }).textPageId : null;
  };

  const toPdfPage = (vp: number): number => {
    const e = sequence[vp - 1];
    return e?.type === 'pdf' ? (e as { type: 'pdf'; pdfPage: number }).pdfPage : -1;
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

// ─── Empty result ─────────────────────────────────────────────────────────────

function emptyResult(pdfPageCount: number) {
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

// ─── New path: build sequence directly from page_order ───────────────────────

function buildFromPageOrder(
  pageOrder: PageOrderEntry[],
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[],
  packages: ProposalPackages[],
  tocSettings: TocSettings | null | undefined,
): VirtualPage[] {
  const sequence: VirtualPage[] = [];
  let pdfPage = 0;

  for (const entry of pageOrder) {
    if (entry.type === 'pdf') {
      pdfPage++;
      sequence.push({ type: 'pdf', pdfPage });
    } else if (entry.type === 'pricing') {
      if (pricing?.enabled) {
        sequence.push({ type: 'pricing' });
      }
    } else if (entry.type === 'packages') {
      const pkg = packages.find((p) => p.id === entry.id);
      if (pkg?.enabled) {
        sequence.push({ type: 'packages', packagesId: pkg.id });
      }
    } else if (entry.type === 'text') {
      const tp = textPages.find((t) => t.id === entry.id);
      if (tp?.enabled) {
        sequence.push({ type: 'text', textPageId: tp.id });
      }
    } else if (entry.type === 'toc') {
      if (tocSettings?.enabled) {
        sequence.push({ type: 'toc' });
      }
    }
  }

  return sequence;
}

// ─── Legacy path: position-based ordering (existing proposals) ───────────────

function buildFromPositions(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[],
  packages: ProposalPackages[],
  tocSettings: TocSettings | null | undefined,
): VirtualPage[] {
  const specials: SpecialPage[] = [];

  if (pricing?.enabled) {
    specials.push({ type: 'pricing', position: pricing.position, title: pricing.title || 'Your Investment' });
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
    specials.push({ type: 'toc', position: tocSettings.position, title: tocSettings.title || 'Table of Contents' });
  }

  for (const tp of textPages) {
    if (tp.enabled) {
      specials.push({ type: 'text', position: tp.position, title: tp.title || 'Text Page', textPageId: tp.id, sortOrder: tp.sort_order });
    }
  }

  if (specials.length === 0) return [];

  const positioned = specials.filter((s) => s.position >= 0);
  const trailing = specials.filter((s) => s.position === -1);

  const typeOrder = (type: string) => {
    if (type === 'text') return 0;
    if (type === 'packages') return 1;
    if (type === 'toc') return 2;
    return 3;
  };

  positioned.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const ta = typeOrder(a.type), tb = typeOrder(b.type);
    if (ta !== tb) return ta - tb;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  // Co-locate child packages immediately after their nearest parent
  const colocate = (arr: SpecialPage[]): SpecialPage[] => {
    const result: SpecialPage[] = [];
    for (const sp of arr) {
      if (sp.type === 'packages' && (sp.indent ?? 0) > 0) {
        let insertAt = result.length;
        for (let i = result.length - 1; i >= 0; i--) {
          if (result[i].type === 'packages' && (result[i].indent ?? 0) === 0) {
            insertAt = i + 1;
            while (insertAt < result.length && result[insertAt].type === 'packages' && (result[insertAt].indent ?? 0) > 0) {
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

  const positionedFinal = colocate(positioned);
  const trailingFinal = colocate(trailing);

  const push = (sequence: VirtualPage[], sp: SpecialPage) => {
    if (sp.type === 'pricing') sequence.push({ type: 'pricing' });
    else if (sp.type === 'packages') sequence.push({ type: 'packages', packagesId: sp.packagesId! });
    else if (sp.type === 'toc') sequence.push({ type: 'toc' });
    else sequence.push({ type: 'text', textPageId: sp.textPageId! });
  };

  const sequence: VirtualPage[] = [];
  let posIdx = 0;

  for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
    while (posIdx < positionedFinal.length && positionedFinal[posIdx].position < pdfPage) {
      push(sequence, positionedFinal[posIdx++]);
    }
    sequence.push({ type: 'pdf', pdfPage });
  }
  while (posIdx < positionedFinal.length) {
    push(sequence, positionedFinal[posIdx++]);
  }

  trailingFinal.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const sp of trailingFinal) push(sequence, sp);

  return sequence;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the virtual page map.
 *
 * When `pageOrder` is provided (new proposals/templates), it is used directly
 * as the authoritative sequence — no position math, no colocate logic.
 *
 * When `pageOrder` is null/undefined (existing records), falls back to the
 * legacy position-based approach for full backward compatibility.
 */
export function buildPageMap(
  pdfPageCount: number,
  pricing: ProposalPricing | null,
  textPages: ProposalTextPage[],
  packages: ProposalPackages[],
  tocSettings?: TocSettings | null,
  pageOrder?: PageOrderEntry[] | null,
) {
  if (pdfPageCount === 0) return emptyResult(0);

  let sequence: VirtualPage[];

  if (pageOrder && pageOrder.length > 0) {
    sequence = buildFromPageOrder(pageOrder, pricing, textPages, packages, tocSettings);

    // ── Fallback: toc_settings.enabled but page_order had no toc entry ──────
    // This happens when TocTab enables the TOC after page_order was already
    // written (the _v2 pages row is created but page_order is not patched).
    if (tocSettings?.enabled && !sequence.some((s) => s.type === 'toc')) {
      const pos = tocSettings.position; // 0 = before first PDF, N = after PDF page N, -1 = end
      if (pos === -1) {
        sequence.push({ type: 'toc' });
      } else {
        // Insert after the Nth pdf virtual page (or at start if pos === 0)
        let pdfsSeen = 0;
        let insertAt = 0;
        for (let i = 0; i < sequence.length; i++) {
          if (sequence[i].type === 'pdf') {
            pdfsSeen++;
            if (pdfsSeen >= pos) {
              insertAt = i + 1;
              break;
            }
          }
          insertAt = i + 1;
        }
        sequence.splice(insertAt, 0, { type: 'toc' });
      }
    }
    // ────────────────────────────────────────────────────────────────────────
  } else {
    sequence = buildFromPositions(pdfPageCount, pricing, textPages, packages, tocSettings);
    if (sequence.length === 0) return emptyResult(pdfPageCount);
  }

  return makeResult(sequence);
}