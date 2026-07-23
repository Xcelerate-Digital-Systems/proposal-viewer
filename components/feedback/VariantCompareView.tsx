'use client';

// components/feedback/VariantCompareView.tsx
//
// Side-by-side comparison grid for Meta ad copy variants. Each cell renders
// the full ad mockup (via AdMockupPreview) with one variant's headline +
// primary text. Clicking a cell exits comparison mode and focuses the
// single-variant view on that variant. Pin comments are hidden — this is a
// read-only overview.

import React from 'react';
import { MessageSquare, Check, AlertTriangle } from 'lucide-react';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import type { MetaAdVariant } from '@/lib/types/feedback';
import type { VariantDecisionSummary } from '@/hooks/useVariantDecisions';

interface VariantCompareViewProps {
  variants: MetaAdVariant[];
  /** The ad creative URL (shared across all variants). */
  creativeUrl: string;
  /** CTA button text (shared). */
  ctaText: string;
  /** Which platform frame to show in each cell. */
  platform: AdPlatform;
  /** Advertiser / page name. */
  pageName?: string;
  /** Page profile image URL. */
  pageImageUrl?: string;
  /** Display URL text. */
  displayUrl?: string;
  /** Brand accent colour for theming. */
  accentColor?: string;
  /** Dark mode. */
  dark?: boolean;
  /** Unresolved comment count keyed by variant id. */
  commentCountsByVariantId?: Record<string, number>;
  /** Click a cell to switch back to single-variant view. */
  onSelectVariant: (variantId: string) => void;
  /** Per-variant decision summaries. */
  decisionSummaries?: Record<string, VariantDecisionSummary>;
}

export default function VariantCompareView({
  variants,
  creativeUrl,
  ctaText,
  platform,
  pageName = 'Your Brand',
  pageImageUrl,
  displayUrl,
  accentColor,
  dark = false,
  commentCountsByVariantId,
  onSelectVariant,
  decisionSummaries,
}: VariantCompareViewProps) {
  // Compute grid columns: 2 for 2 variants, 2 for 3–4, 3 for 5–6, etc.
  const cols = variants.length <= 2 ? variants.length : variants.length <= 4 ? 2 : 3;

  return (
    <div
      className="w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '1rem',
      }}
    >
      {variants.map((v, i) => {
        const commentCount = commentCountsByVariantId?.[v.id] ?? 0;
        const label = v.label?.trim() || `Variant ${i + 1}`;
        const summary = decisionSummaries?.[v.id];

        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelectVariant(v.id)}
            className="group text-left rounded-xl border transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40"
            style={{
              borderColor: dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
              backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#fafafa',
            }}
          >
            {/* Cell header — variant label + comment badge + decision badge */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-semibold shrink-0"
                  style={{
                    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                    color: dark ? 'rgba(255,255,255,0.6)' : '#6B7280',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: dark ? '#e4e6eb' : '#374151' }}
                >
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {summary && summary.total > 0 && (
                  <VariantDecisionBadge summary={summary} dark={dark} />
                )}
                {commentCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-2xs font-semibold"
                    style={{
                      backgroundColor: '#FFF1D6',
                      color: '#92500F',
                    }}
                  >
                    <MessageSquare size={9} />
                    {commentCount}
                  </span>
                )}
              </div>
            </div>

            {/* Scaled-down mockup */}
            <div className="p-3 pointer-events-none" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
              <AdMockupPreview
                creativeUrl={creativeUrl}
                headline={v.headline}
                primaryText={v.primary_text}
                ctaText={ctaText}
                platform={platform}
                pageName={pageName}
                pageImageUrl={pageImageUrl}
                displayUrl={displayUrl}
                accentColor={accentColor}
                dark={dark}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Decision badge for comparison cells                                */
/* ================================================================== */

function VariantDecisionBadge({
  summary,
  dark,
}: {
  summary: VariantDecisionSummary;
  dark?: boolean;
}) {
  const allApproved = summary.approved === summary.total && summary.total > 0;
  const hasChanges = summary.changes_requested > 0;

  if (allApproved) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-2xs font-semibold"
        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
      >
        <Check size={9} />
        {summary.approved}/{summary.total}
      </span>
    );
  }

  if (hasChanges) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-2xs font-semibold"
        style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
      >
        <AlertTriangle size={9} />
        {summary.changes_requested}/{summary.total}
      </span>
    );
  }

  if (summary.approved > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-2xs font-semibold"
        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
      >
        <Check size={9} />
        {summary.approved}/{summary.total}
      </span>
    );
  }

  return null;
}
