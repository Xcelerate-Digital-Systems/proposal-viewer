// components/viewer/quote-view/useQuoteTokens.ts
// Custom hook that computes all pricing math + design tokens for the quote
// single-page view. Extracted from QuoteSinglePageView so the render body
// is pure JSX.

'use client';

import { useEffect, useState } from 'react';
import {
  supabase,
  type Proposal,
  type ProposalPricing,
  type PricingLineItem,
  type PricingOptionalItem,
  formatCurrency,
  pricingEffectiveSubtotal,
  type CurrencyCode,
} from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { useBrandPalette } from '@/hooks/useBrandPalette';
import { parseQuoteExtras } from '@/lib/types/quote-extras';
import { parseDecisionExtras } from '@/lib/types/decision-extras';
import {
  TABULAR,
  fontStack,
  withAlpha,
  buildHeaderBackground,
  deriveDeposit,
  formatValidUntil,
  parsePhotos,
  computeExpiryState,
} from './quote-view-helpers';

interface UseQuoteTokensArgs {
  proposal: Proposal;
  pricing: ProposalPricing | null;
  branding: CompanyBranding;
  resolvedBgUrl?: string | null;
  companyName?: string;
  quoteNumberFormat?: { prefix?: string | null; padWidth?: number | null };
}

export function useQuoteTokens({
  proposal,
  pricing,
  branding,
  resolvedBgUrl,
  companyName,
  quoteNumberFormat: _quoteNumberFormat,
}: UseQuoteTokensArgs) {
  const palette = useBrandPalette(branding);
  const decisionExtras = parseDecisionExtras(
    (proposal as { decision_extras?: unknown }).decision_extras,
  );
  const photoPaths = parsePhotos(proposal.project_photos);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [coverImgUrl, setCoverImgUrl] = useState<string | null>(resolvedBgUrl ?? null);
  const extras = parseQuoteExtras(proposal.quote_extras);

  // Resolve signed URLs for project photos
  useEffect(() => {
    if (photoPaths.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const path of photoPaths) {
        const { data } = await supabase.storage
          .from('proposals')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) next[path] = data.signedUrl;
      }
      if (!cancelled) setPhotoUrls(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPaths.join('|')]);

  // Fallback cover image (only used when no project photos set)
  useEffect(() => {
    if (resolvedBgUrl !== undefined && resolvedBgUrl !== null) return;
    if (photoPaths.length > 0) return;
    if (!proposal.cover_image_path) return;
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(proposal.cover_image_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setCoverImgUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [proposal.cover_image_path, resolvedBgUrl, photoPaths.length]);

  /* ── Pricing maths ──────────────────────────────────────────── */

  const proposalCurrency = ((proposal as Record<string, unknown>).currency as CurrencyCode) || 'AUD';
  const fmt = (amount: number) => formatCurrency(amount, proposalCurrency);

  const items: PricingLineItem[] = pricing?.items ?? [];
  const optionalItems: PricingOptionalItem[] = pricing?.optional_items ?? [];
  const subtotal = pricingEffectiveSubtotal(items);

  const gstEnabled =
    proposal.include_gst !== null && proposal.include_gst !== undefined
      ? proposal.include_gst
      : !!pricing?.tax_enabled;
  const gstRatePct =
    proposal.gst_rate !== null && proposal.gst_rate !== undefined
      ? proposal.gst_rate * 100
      : (pricing?.tax_rate ?? 10);
  const taxRate = gstEnabled ? gstRatePct : 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount;

  // Prefer the flat deposit columns; fall back to legacy payment_schedule.
  const useFlatDeposit =
    proposal.require_deposit !== null && proposal.require_deposit !== undefined;
  const deposit = useFlatDeposit
    ? (proposal.require_deposit
        ? {
            amount: Math.round(total * ((proposal.deposit_percent ?? 0) / 100) * 100) / 100,
            pct: proposal.deposit_percent ?? 0,
            label: 'Deposit',
          }
        : null)
    : deriveDeposit(pricing, total);

  // Full milestone schedule (when more than one payment exists)
  const milestones = (!useFlatDeposit && pricing?.payment_schedule?.milestones?.enabled
    && pricing.payment_schedule.milestones.payments.length > 1)
    ? pricing.payment_schedule.milestones.payments
    : [];

  const validUntil = proposal.valid_until
    ? new Date(proposal.valid_until).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : formatValidUntil(pricing);

  const expiryState = computeExpiryState(proposal, pricing);

  const quoteDate = (pricing?.proposal_date || proposal.created_at)
    ? new Date(pricing?.proposal_date || proposal.created_at).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  // Prefer the new scope_of_works field; fall back to legacy description.
  const scopeOfWorks = proposal.scope_of_works || proposal.description || '';
  const attachments = Array.isArray(proposal.attachments) ? proposal.attachments : [];

  /* ── Cover header tokens ───────────────────────────────────── */

  const headerBg = buildHeaderBackground(proposal);
  const headerText = proposal.quote_header_text_color ?? proposal.cover_text_color ?? '#ffffff';
  const headerSubtle = proposal.quote_header_subtitle_color ?? proposal.cover_subtitle_color ?? withAlpha(headerText, 0.55);
  const displayCompanyName = companyName || branding.name;

  /* ── Body design tokens — 3-tier cascade ───────────────────── */

  const bodyBg =
    proposal.text_page_bg_color || branding.text_page_bg_color || '#ffffff';
  const bodyText =
    proposal.text_page_text_color || branding.text_page_text_color || '#1E2432';
  const headingColor =
    proposal.text_page_heading_color || branding.text_page_heading_color || bodyText;
  const muted = palette.mutedText;
  const faint = palette.faintText;
  const hairline = palette.borderSubtle;

  const bodyFontFamily = fontStack(branding.font_body, 'inherit');
  const headingFontFamily = fontStack(branding.font_heading, 'inherit');
  const titleFontFamily = fontStack(
    proposal.title_font_family || branding.title_font_family || branding.font_heading,
    'inherit',
  );
  const titleFontWeight = proposal.title_font_weight || branding.title_font_weight || '600';

  /* ── Style snippets ────────────────────────────────────────── */

  const bodyFontWeight = branding.font_body_weight ? Number(branding.font_body_weight) : undefined;
  const headingFontWeight = branding.font_heading_weight ? Number(branding.font_heading_weight) : undefined;

  const articleStyle: React.CSSProperties = {
    backgroundColor: bodyBg,
    color: bodyText,
    fontFamily: bodyFontFamily,
    fontWeight: bodyFontWeight,
    ...TABULAR,
  };
  const labelStyle: React.CSSProperties = {
    color: faint,
    fontFamily: headingFontFamily,
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: '0.75rem',
  };
  const headingTextStyle: React.CSSProperties = {
    color: headingColor,
    fontFamily: headingFontFamily,
  };
  const titleStyle: React.CSSProperties = {
    fontFamily: titleFontFamily,
    fontWeight: Number(titleFontWeight) || 600,
    color: headingColor,
  };
  const mutedStyle: React.CSSProperties = { color: muted };

  /* ── Photo positioning ─────────────────────────────────────── */

  const heroUrl = photoPaths[0] ? photoUrls[photoPaths[0]] : coverImgUrl;
  const featureUrl = photoPaths[1] ? photoUrls[photoPaths[1]] : null;

  return {
    palette,
    decisionExtras,
    extras,

    // Pricing
    proposalCurrency,
    fmt,
    items,
    optionalItems,
    subtotal,
    gstEnabled,
    gstRatePct,
    taxRate,
    taxAmount,
    total,
    deposit,
    milestones,
    validUntil,
    expiryState,
    quoteDate,
    scopeOfWorks,
    attachments,

    // Header tokens
    headerBg,
    headerText,
    headerSubtle,
    displayCompanyName,

    // Body tokens
    bodyBg,
    bodyText,
    headingColor,
    muted,
    faint,
    hairline,
    bodyFontFamily,
    headingFontFamily,
    titleFontFamily,
    titleFontWeight,

    // Style objects
    articleStyle,
    labelStyle,
    headingTextStyle,
    titleStyle,
    mutedStyle,

    // Photos
    heroUrl,
    featureUrl,
  };
}
