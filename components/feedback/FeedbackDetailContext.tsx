'use client';

import { createContext, useContext, useMemo } from 'react';
import type { FeedbackProject, FeedbackItem } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import type { VersionView } from '@/lib/feedback/versions';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';

/** Shape returned by useBrandingColors — kept in sync manually */
interface BrandingColors {
  accent: string;
  border: string;
  sidebarText: string;
  bgSecondary: string;
}

/* ================================================================== */
/*  Context shape                                                      */
/* ================================================================== */

export interface FeedbackDetailContextValue {
  // ── Mode ──
  mode: 'admin' | 'client';
  isAdmin: boolean;
  isClient: boolean;

  // ── Core data ──
  project: FeedbackProject;
  selectedItem: FeedbackItem | null;

  // ── Branding ──
  branding?: CompanyBranding;
  brandingColors: BrandingColors;
  accentColor: string;

  // ── Identity ──
  /** Admin: fixed author display name */
  authorName?: string;
  /** Client: guest name (editable) */
  guestName?: string;
  /** Client: update guest name */
  onGuestNameChange?: (name: string) => void;
  /** Client: reviewer email */
  reviewerEmail?: string;

  // ── Session ──
  shareToken?: string;
  companyId?: string;
  browseMode: boolean;
  commentsLocked: boolean;

  // ── Derived ──
  participantsUrl: string | null;
  memberLookup: TeamMemberLookup;

  // ── Versions ──
  versions?: VersionView[];
  activeVersionId: string | null;
  onVersionChange?: (versionId: string | null) => void;
  onAddVersion?: () => void;
  onEditVersion?: (versionId: string | null) => void;
}

const FeedbackDetailContext = createContext<FeedbackDetailContextValue | null>(null);

/* ================================================================== */
/*  Provider                                                           */
/* ================================================================== */

interface FeedbackDetailProviderProps {
  value: FeedbackDetailContextValue;
  children: React.ReactNode;
}

export function FeedbackDetailProvider({ value, children }: FeedbackDetailProviderProps) {
  return (
    <FeedbackDetailContext.Provider value={value}>
      {children}
    </FeedbackDetailContext.Provider>
  );
}

/* ================================================================== */
/*  Consumer hook                                                      */
/* ================================================================== */

/**
 * Access the FeedbackDetail context. Must be used within a
 * <FeedbackDetailProvider>. Throws if used outside the provider.
 */
export function useFeedbackDetail(): FeedbackDetailContextValue {
  const ctx = useContext(FeedbackDetailContext);
  if (!ctx) {
    throw new Error('useFeedbackDetail must be used within a FeedbackDetailProvider');
  }
  return ctx;
}

/* ================================================================== */
/*  Helper: build context value from FeedbackDetailView props          */
/* ================================================================== */

/**
 * Convenience function to construct the context value from the props
 * that FeedbackDetailView already has. Keeps the provider setup in
 * FeedbackDetailView minimal.
 */
export interface BuildContextParams {
  mode: 'admin' | 'client';
  project: FeedbackProject;
  selectedItem: FeedbackItem | null;
  branding?: CompanyBranding;
  brandingColors: BrandingColors;
  authorName?: string;
  guestName?: string;
  onGuestNameChange?: (name: string) => void;
  reviewerEmail?: string;
  shareToken?: string;
  companyId?: string;
  browseMode: boolean;
  commentsLocked: boolean;
  participantsUrl: string | null;
  memberLookup: TeamMemberLookup;
  versions?: VersionView[];
  activeVersionId: string | null;
  onVersionChange?: (versionId: string | null) => void;
  onAddVersion?: () => void;
  onEditVersion?: (versionId: string | null) => void;
}

export function buildFeedbackDetailContext(params: BuildContextParams): FeedbackDetailContextValue {
  const isAdmin = params.mode === 'admin';
  const isClient = params.mode === 'client';
  return {
    ...params,
    isAdmin,
    isClient,
    accentColor: params.branding?.accent_color || params.brandingColors.accent,
  };
}
