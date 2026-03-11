// lib/export/types.ts

import type { CompanyBranding, ProposalTextPage, PageUrlEntry } from '@/hooks/useProposal';
import type { Proposal, ProposalPricing, ProposalPackages, PageNameEntry, TocSettings } from '@/lib/supabase';

// ── Constants ────────────────────────────────────────────────────────

/** A4 fallback dimensions in PDF points (72 pts/inch) */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/** Base capture width for html2canvas (px) — wider = sharper */
export const BASE_CAPTURE_WIDTH = 1440;

// ── Shared types ─────────────────────────────────────────────────────

/** Base text page shape — works for both ProposalTextPage and DocumentTextPage */
export interface BaseTextPage {
  id: string;
  enabled: boolean;
  position: number;
  title: string;
  content: unknown;
  sort_order: number;
}

export type BgImageCtx = {
  branding: CompanyBranding;
  dataUrl: string;
};

export interface DominantPageSize {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

/** Pre-fetched member badge data for PDF export, keyed by member ID */
export type MemberBadgeMap = Record<string, { name: string; avatar_url: string | null }>;

// ── Main options type ────────────────────────────────────────────────

export interface CompositeExportOptions {
  /** Legacy single merged PDF URL. Null when per-page mode is active. */
  pdfUrl: string | null;
  /** Per-page signed URL entries (primary path post-migration). */
  pageUrls?: PageUrlEntry[];
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
  /** Signed URL for the client logo — converted to a data URL internally for export. */
  clientLogoUrl?: string | null;
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