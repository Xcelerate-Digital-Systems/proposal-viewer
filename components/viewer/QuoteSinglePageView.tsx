// components/viewer/QuoteSinglePageView.tsx
// Single-page quote viewer. Editorial layout — every visible element pulls
// its colour and font from the same three-tier cascade (per-quote → company
// branding → fallback) so the Design tab actually drives the whole document
// and not just headlines.

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
import { parseQuoteExtras } from '@/lib/types/quote-extras';
import { formatQuoteNumber } from '@/lib/quote-number';
import { buildGradientCss, resolveStops } from '@/lib/gradient-stops';
import ProposalDecisionPanel from '@/components/viewer/ProposalDecisionPanel';
import { Clock, AlertTriangle } from 'lucide-react';

interface QuoteSinglePageViewProps {
  proposal: Proposal;
  pricing: ProposalPricing | null;
  branding: CompanyBranding;
  onAccept?: (name: string, signatureData?: { mode: string; typed_name?: string; signature_image_base64?: string } | null) => Promise<void>;
  onDecline?: (name: string, reason: string) => Promise<void>;
  onRequestRevision?: (name: string, notes: string) => Promise<void>;
  accepted?: boolean;
  declined?: boolean;
  revisionRequested?: boolean;
  requireSignature?: boolean;
  resolvedBgUrl?: string | null;
  companyName?: string;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyAbn?: string | null;
  /** Per-company quote-number format. Defaults to "Q-" prefix + 3-digit pad. */
  quoteNumberFormat?: { prefix?: string | null; padWidth?: number | null };
  /** Reserved — currently no compact-specific styling. */
  compact?: boolean;
}

/* ── Style helpers ──────────────────────────────────────────────────────── */

const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

function fontStack(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  return `'${name}', ${fallback}`;
}

/** Convert any CSS colour to rgba with explicit alpha. Falls back gracefully. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  // Already rgb()/rgba()/named — wrap in color-mix for alpha overlay.
  return `color-mix(in srgb, ${hex} ${alpha * 100}%, transparent)`;
}

/* ── Domain helpers ─────────────────────────────────────────────────────── */

function buildHeaderBackground(p: Proposal): string {
  // Quote body header band uses quote_header_* with fallback to cover_*
  // (so existing quotes keep their look until the user explicitly diverges).
  const style = (p.quote_header_bg_style ?? p.cover_bg_style) === 'solid' ? 'solid' : 'gradient';
  const c1    = p.quote_header_bg_color_1 ?? p.cover_bg_color_1 ?? '#0f172a';
  const c2    = p.quote_header_bg_color_2 ?? p.cover_bg_color_2 ?? '#1e293b';
  const angle = p.quote_header_gradient_angle ?? p.cover_gradient_angle ?? 135;
  const cx    = p.quote_header_gradient_position_x ?? p.cover_gradient_position_x ?? 50;
  const cy    = p.quote_header_gradient_position_y ?? p.cover_gradient_position_y ?? 50;
  const type  = (p.quote_header_gradient_type ?? p.cover_gradient_type ?? 'linear') as 'linear' | 'radial' | 'conic';
  const stopsRaw = p.quote_header_gradient_stops ?? p.cover_gradient_stops;
  const stops = resolveStops(stopsRaw, c1, c2);
  return buildGradientCss(style, type, angle, cx, cy, stops);
}

function deriveDeposit(pricing: ProposalPricing | null, total: number) {
  if (!pricing?.payment_schedule) return null;
  const sched = pricing.payment_schedule;
  if (sched.milestones?.enabled && sched.milestones.payments.length > 0) {
    const first = sched.milestones.payments[0];
    const amount =
      first.type === 'percentage'
        ? Math.round(total * (first.value / 100) * 100) / 100
        : first.value;
    const pct = first.type === 'percentage' ? first.value : Math.round((first.value / total) * 100);
    return { amount, pct, label: first.label || 'Deposit' };
  }
  if (sched.one_off?.enabled && sched.one_off.amount > 0) {
    return {
      amount: sched.one_off.amount,
      pct: total > 0 ? Math.round((sched.one_off.amount / total) * 100) : 0,
      label: sched.one_off.label || 'Deposit',
    };
  }
  return null;
}

function formatValidUntil(pricing: ProposalPricing | null): string | null {
  if (!pricing?.validity_days || !pricing.proposal_date) return null;
  const start = new Date(pricing.proposal_date);
  start.setDate(start.getDate() + pricing.validity_days);
  return start.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parsePhotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === 'string');
}

/* ── Expiry urgency helpers ─────────────────────────────────────────────── */

type ExpiryState =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'soon'; days: number }   // 2–3 days
  | { kind: 'valid'; label: string }; // >3 days — just show the date

function computeExpiryState(
  proposal: { valid_until: string | null },
  pricing: { validity_days?: number | null; proposal_date?: string | null } | null,
): ExpiryState {
  let expiryDate: Date | null = null;

  if (proposal.valid_until) {
    expiryDate = new Date(proposal.valid_until);
  } else if (pricing?.validity_days && pricing.proposal_date) {
    expiryDate = new Date(pricing.proposal_date);
    expiryDate.setDate(expiryDate.getDate() + pricing.validity_days);
  }

  if (!expiryDate || isNaN(expiryDate.getTime())) return { kind: 'none' };

  // Compare at day granularity in local time
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryStart = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate(),
  );
  const diffMs = expiryStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { kind: 'expired' };
  if (diffDays === 0) return { kind: 'today' };
  if (diffDays === 1) return { kind: 'tomorrow' };
  if (diffDays <= 3) return { kind: 'soon', days: diffDays };

  const label = expiryDate.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return { kind: 'valid', label };
}

/* ── Layout primitives — hoisted out of the component so they don't get
   remounted on every keystroke. Defining components inline causes React to
   treat each render as a new component type, which destroys the DOM tree
   inside them and resets focus / scroll position. */

function Section({ children }: { children: React.ReactNode }) {
  return <section className="px-8 sm:px-14 py-10 print:py-7">{children}</section>;
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return <div style={style}>{children}</div>;
}

function Hairline({ color }: { color: string }) {
  return (
    <div
      className="mx-8 sm:mx-14 print:mx-0"
      style={{ height: 1, backgroundColor: color }}
    />
  );
}

/* Resolves a Supabase storage path to a short-lived signed URL so the
   recipient can download an attachment without needing a Supabase account. */
function AttachmentLink({
  path,
  name,
  mime,
  muted,
}: {
  path: string;
  name: string;
  mime: string;
  muted: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 underline decoration-dotted underline-offset-4 hover:no-underline"
      style={{ color: 'inherit' }}
    >
      <span>{name}</span>
      <span className="text-detail uppercase tracking-wider" style={{ color: muted }}>
        {mime.split('/').pop()?.slice(0, 6) ?? 'file'}
      </span>
    </a>
  );
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function QuoteSinglePageView({
  proposal,
  pricing,
  branding,
  onAccept,
  onDecline,
  onRequestRevision,
  accepted: initialAccepted,
  declined: initialDeclined,
  revisionRequested: initialRevisionRequested,
  requireSignature,
  resolvedBgUrl,
  companyName,
  companyPhone,
  companyEmail,
  companyAbn,
  quoteNumberFormat,
}: QuoteSinglePageViewProps) {
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
  // Quote-V2 columns (include_gst / gst_rate / require_deposit / deposit_percent
  // / valid_until on the proposal row) take precedence when non-null. Legacy
  // quotes fall back to the pricing-page payload so nothing regresses.

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

  const validUntil = proposal.valid_until
    ? new Date(proposal.valid_until).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : formatValidUntil(pricing);

  const expiryState = computeExpiryState(proposal, pricing);

  // Prefer the new scope_of_works field; fall back to legacy description.
  const scopeOfWorks = proposal.scope_of_works || proposal.description || '';
  const attachments = Array.isArray(proposal.attachments) ? proposal.attachments : [];

  /* ── Cover header tokens ───────────────────────────────────── */

  const headerBg = buildHeaderBackground(proposal);
  // Quote body header text/subtitle — prefer quote_header_* with cover_* as
  // a fallback so legacy quotes keep their existing look.
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
  const muted = withAlpha(bodyText, 0.6);
  const faint = withAlpha(bodyText, 0.45);
  const hairline = withAlpha(bodyText, 0.1);

  const bodyFontFamily = fontStack(branding.font_body, 'inherit');
  const headingFontFamily = fontStack(branding.font_heading, 'inherit');
  const titleFontFamily = fontStack(
    proposal.title_font_family || branding.title_font_family || branding.font_heading,
    'inherit',
  );
  const titleFontWeight = proposal.title_font_weight || branding.title_font_weight || '600';

  /* ── Style snippets, applied inline so they take precedence over Tailwind ─ */

  const articleStyle: React.CSSProperties = {
    backgroundColor: bodyBg,
    color: bodyText,
    fontFamily: bodyFontFamily,
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

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <article style={articleStyle}>
      {/* ── Cover ─────────────────────────────────────────────── */}
      {/* min-h-[60vh] so the cover dominates the first viewport on the public
          viewer — gives the "cover-first" feel without needing a click-through. */}
      <header
        className="relative px-6 sm:px-14 pt-8 sm:pt-10 pb-10 sm:pb-12 min-h-[60vh] flex flex-col print:min-h-0"
        style={{ background: headerBg, color: headerText }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 text-detail tracking-[0.12em] uppercase mb-8 sm:mb-12 opacity-80"
          style={{ fontFamily: headingFontFamily }}
        >
          <span style={{ color: headerText }}>{displayCompanyName}</span>
          <span className="flex items-center gap-x-4 gap-y-1 flex-wrap" style={{ color: headerSubtle }}>
            {companyPhone && <span>{companyPhone}</span>}
            {companyEmail && <span className="break-all">{companyEmail}</span>}
          </span>
        </div>

        {heroUrl && (
          <div
            className="rounded-sm overflow-hidden mb-12 aspect-[16/7] bg-center bg-cover"
            style={{ backgroundImage: `url(${heroUrl})` }}
          />
        )}

        <div
          className="text-2xs tracking-[0.22em] uppercase opacity-60 mb-4 flex items-center gap-3"
          style={{ color: headerSubtle, fontFamily: headingFontFamily }}
        >
          <span>Quote</span>
          {formatQuoteNumber(proposal.quote_number, quoteNumberFormat) && (
            <>
              <span className="opacity-50">·</span>
              <span style={TABULAR}>{formatQuoteNumber(proposal.quote_number, quoteNumberFormat)}</span>
            </>
          )}
        </div>
        <h1
          className="leading-[1.05] mb-10 max-w-3xl tracking-tight"
          style={{
            fontSize: proposal.title_font_size || 'clamp(2rem, 4.5vw, 3.5rem)',
            color: headerText,
            fontFamily: titleFontFamily,
            fontWeight: Number(titleFontWeight) || 600,
          }}
        >
          {proposal.title || 'Your Project Quote'}
        </h1>

        <div
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6 pt-6 mt-auto"
          style={{ borderTop: `1px solid ${withAlpha(headerText, 0.1)}` }}
        >
          <div className="min-w-0">
            <div
              className="text-2xs tracking-[0.22em] uppercase opacity-60 mb-1"
              style={{ color: headerSubtle, fontFamily: headingFontFamily }}
            >
              Prepared for
            </div>
            <div className="text-base truncate" style={{ color: headerText }}>
              {proposal.client_name || '—'}
            </div>
            {proposal.client_organisation && (
              <div className="text-xs opacity-80 truncate" style={{ color: headerSubtle }}>
                {proposal.client_organisation}
              </div>
            )}
            {proposal.site_address && (
              <div className="text-xs opacity-70 mt-0.5 truncate" style={{ color: headerSubtle }}>
                {proposal.site_address}
              </div>
            )}
          </div>
          <div className="text-left sm:text-right">
            <div
              className="text-2xs tracking-[0.22em] uppercase opacity-60 mb-1"
              style={{ color: headerSubtle, fontFamily: headingFontFamily }}
            >
              Total
            </div>
            <div
              className="tracking-tight"
              style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                color: headerText,
                fontFamily: titleFontFamily,
                fontWeight: Number(titleFontWeight) || 600,
                ...TABULAR,
              }}
            >
              {fmt(total)}
            </div>
            {validUntil && (
              <div
                className="text-2xs tracking-[0.18em] uppercase mt-2 opacity-60"
                style={{ color: headerSubtle, fontFamily: headingFontFamily }}
              >
                Valid until {validUntil}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Trust line ────────────────────────────────────────── */}
      {extras.badges.length > 0 && (
        <div
          className="px-8 sm:px-14 py-5 text-detail tracking-[0.16em] uppercase text-center"
          style={{
            color: muted,
            fontFamily: headingFontFamily,
            borderBottom: `1px solid ${hairline}`,
          }}
        >
          {extras.badges.map((b, i) => (
            <span key={i}>
              {b}
              {i < extras.badges.length - 1 && <span className="mx-3 opacity-40">·</span>}
            </span>
          ))}
        </div>
      )}

      {/* ── Expiry urgency banner ────────────────────────────── */}
      {expiryState.kind === 'expired' && (
        <div
          className="mx-8 sm:mx-14 mt-6 rounded-lg px-5 py-3.5 flex items-center gap-3 text-sm print:hidden"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            color: '#b91c1c',
            fontFamily: headingFontFamily,
          }}
        >
          <AlertTriangle size={18} className="shrink-0" />
          <span className="font-medium">This quote has expired</span>
        </div>
      )}
      {(expiryState.kind === 'today' ||
        expiryState.kind === 'tomorrow' ||
        expiryState.kind === 'soon') && (
        <div
          className="mx-8 sm:mx-14 mt-6 rounded-lg px-5 py-3.5 flex items-center gap-3 text-sm print:hidden"
          style={{
            backgroundColor: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            color: '#92400e',
            fontFamily: headingFontFamily,
          }}
        >
          <Clock size={18} className="shrink-0" />
          <span className="font-medium">
            {expiryState.kind === 'today' && 'This quote expires today'}
            {expiryState.kind === 'tomorrow' && 'This quote expires tomorrow'}
            {expiryState.kind === 'soon' &&
              `This quote expires in ${expiryState.days} days`}
          </span>
        </div>
      )}
      {expiryState.kind === 'valid' && (
        <div
          className="mx-8 sm:mx-14 mt-6 rounded-lg px-5 py-3.5 flex items-center gap-3 text-xs print:hidden"
          style={{
            backgroundColor: withAlpha(bodyText, 0.03),
            border: `1px solid ${withAlpha(bodyText, 0.08)}`,
            color: muted,
            fontFamily: headingFontFamily,
          }}
        >
          <Clock size={16} className="shrink-0" />
          <span>Valid until {expiryState.label}</span>
        </div>
      )}

      {/* ── About Us ──────────────────────────────────────────── */}
      {extras.about_us && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>About</SectionLabel>
            <p className="leading-[1.7] whitespace-pre-wrap max-w-2xl">{extras.about_us}</p>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Testimonial ───────────────────────────────────────── */}
      {extras.testimonial && (
        <>
          <Section>
            <blockquote
              className="italic leading-[1.5] max-w-2xl"
              style={{ fontSize: 'clamp(1.125rem, 1.6vw, 1.5rem)', color: bodyText }}
            >
              &ldquo;{extras.testimonial}&rdquo;
            </blockquote>
            {extras.testimonial_author && (
              <div
                className="mt-4 text-xs tracking-[0.14em] uppercase"
                style={{ color: muted, fontFamily: headingFontFamily }}
              >
                {extras.testimonial_author.replace(/^[—-]\s*/, '— ')}
              </div>
            )}
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Feature image (Photo 2) ───────────────────────────── */}
      {featureUrl && (
        <>
          <Section>
            <div
              className="aspect-[16/7] bg-center bg-cover rounded-sm"
              style={{ backgroundImage: `url(${featureUrl})` }}
            />
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Scope of Works ────────────────────────────────────── */}
      {scopeOfWorks && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>Scope of Works</SectionLabel>
            <p className="leading-[1.7] whitespace-pre-wrap max-w-2xl">{scopeOfWorks}</p>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Breakdown ─────────────────────────────────────────── */}
      {items.length > 0 && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>Breakdown</SectionLabel>
            <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[480px]" style={TABULAR}>
              <thead>
                <tr
                  className="text-2xs tracking-[0.18em] uppercase"
                  style={{
                    color: faint,
                    fontFamily: headingFontFamily,
                    borderBottom: `1px solid ${hairline}`,
                  }}
                >
                  <th className="text-left py-3 font-medium">Item</th>
                  <th className="text-right py-3 font-medium w-16">Qty</th>
                  <th className="text-right py-3 font-medium w-24">Unit $</th>
                  <th className="text-right py-3 font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className="align-top last:[&_td]:border-0"
                    style={{ borderBottom: `1px solid ${withAlpha(bodyText, 0.07)}` }}
                  >
                    <td className="py-4 pr-6">
                      <div className="text-[15px]" style={{ color: bodyText }}>
                        {it.label || '—'}
                      </div>
                      {it.description && (
                        <div className="text-xs mt-1 leading-relaxed" style={{ color: muted }}>
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: muted }}>
                      {it.qty ?? 1}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: muted }}>
                      {it.unit_price != null ? fmt(it.unit_price) : '—'}
                    </td>
                    <td className="py-4 text-right text-[15px]" style={{ color: bodyText }}>
                      {fmt(it.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Optional Add-Ons ──────────────────────────────────── */}
      {optionalItems.length > 0 && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>Optional Add-Ons</SectionLabel>
            <p className="text-xs leading-relaxed mb-4 max-w-2xl" style={{ color: muted }}>
              Not included in the total above — let us know which (if any) to include.
            </p>
            <div className="space-y-3">
              {optionalItems.map((it) => {
                const eff =
                  (it.amount ?? 0) * (1 - ((it.discount_pct ?? 0) / 100));
                return (
                  <div
                    key={it.id}
                    className="flex items-start justify-between gap-4 py-3"
                    style={{ borderBottom: `1px solid ${withAlpha(bodyText, 0.07)}` }}
                  >
                    <div className="min-w-0">
                      <div className="text-[15px]" style={{ color: bodyText }}>
                        {it.label || '—'}
                      </div>
                      {it.description && (
                        <div className="text-xs mt-1 leading-relaxed" style={{ color: muted }}>
                          {it.description}
                        </div>
                      )}
                    </div>
                    <div className="text-[15px] shrink-0" style={{ color: bodyText, ...TABULAR }}>
                      {fmt(eff)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Investment ────────────────────────────────────────── */}
      {/* Takes the header fill so the total reads as the document's hero
          figure. Deposit is intentionally a smaller chip in the corner so it
          doesn't compete with the headline total. Valid-until sits below the
          row in the same dark card. */}
      <Section>
        <SectionLabel style={labelStyle}>Investment</SectionLabel>
        <div
          className="rounded-2xl px-6 py-7 sm:px-8 sm:py-8"
          style={{
            background: headerBg,
            color: headerText,
            // Faint inner border so the card edge stays visible against a
            // matching body background.
            boxShadow: `inset 0 0 0 1px ${withAlpha(headerText, 0.08)}`,
          }}
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <div
                style={{
                  ...labelStyle,
                  color: withAlpha(headerText, 0.55),
                  marginBottom: '0.5rem',
                }}
              >
                Total Amount
              </div>
              <div
                className="tracking-tight"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3rem)',
                  color: headerText,
                  fontFamily: titleFontFamily,
                  fontWeight: Number(titleFontWeight) || 600,
                  lineHeight: 1.05,
                  ...TABULAR,
                }}
              >
                {fmt(total)}
              </div>
              {gstEnabled && (
                <div className="text-xs mt-2" style={{ color: withAlpha(headerText, 0.6) }}>
                  Incl. GST ({fmt(taxAmount)})
                </div>
              )}
            </div>

            {deposit && (
              <div
                className="rounded-lg px-4 py-3 shrink-0"
                style={{
                  backgroundColor: withAlpha(headerText, 0.08),
                  boxShadow: `inset 0 0 0 1px ${withAlpha(headerText, 0.12)}`,
                  minWidth: 160,
                }}
              >
                <div
                  style={{
                    ...labelStyle,
                    color: withAlpha(headerText, 0.55),
                    marginBottom: '0.25rem',
                  }}
                >
                  Deposit Required
                </div>
                <div
                  className="text-detail tabular-nums"
                  style={{ color: withAlpha(headerText, 0.6) }}
                >
                  {deposit.pct}% upfront
                </div>
                <div
                  className="text-right text-xl font-semibold mt-1 tabular-nums"
                  style={{ color: headerText }}
                >
                  {fmt(deposit.amount)}
                </div>
              </div>
            )}
          </div>

          {validUntil && (
            <div
              className="mt-6 pt-4 text-xs"
              style={{
                color: withAlpha(headerText, 0.6),
                borderTop: `1px solid ${withAlpha(headerText, 0.12)}`,
              }}
            >
              Valid until <span style={{ color: headerText, fontWeight: 500 }}>{validUntil}</span>
            </div>
          )}
        </div>
      </Section>
      <Hairline color={hairline} />

      {/* ── Next Steps ────────────────────────────────────────── */}
      {extras.next_steps.length > 0 && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>Next Steps</SectionLabel>
            <ol className="space-y-3 text-[15px] max-w-xl">
              {extras.next_steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="text-xs tracking-[0.1em] mt-1 w-6 shrink-0"
                    style={{ color: faint, fontFamily: headingFontFamily, ...TABULAR }}
                  >
                    0{i + 1}
                  </span>
                  <span className="leading-[1.6]">{step}</span>
                </li>
              ))}
            </ol>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Attachments ───────────────────────────────────────── */}
      {attachments.length > 0 && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>Attachments</SectionLabel>
            <ul className="space-y-2 text-sm max-w-xl">
              {attachments.map((a, i) => (
                <li key={`${a.path}-${i}`}>
                  <AttachmentLink path={a.path} name={a.name} mime={a.mime} muted={muted} />
                </li>
              ))}
            </ul>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Terms ─────────────────────────────────────────────── */}
      {extras.terms && (
        <>
          <Section>
            <SectionLabel style={labelStyle}>Terms</SectionLabel>
            <p
              className="text-xs whitespace-pre-wrap leading-[1.7] max-w-2xl"
              style={{ color: muted }}
            >
              {extras.terms}
            </p>
          </Section>
          <Hairline color={hairline} />
        </>
      )}

      {/* ── Decision form ─────────────────────────────────────── */}
      {(onAccept || onDecline || onRequestRevision) && (
        <Section>
          <ProposalDecisionPanel
            onAccept={onAccept}
            onDecline={onDecline}
            onRequestRevision={onRequestRevision}
            requireSignature={requireSignature}
            accepted={initialAccepted}
            declined={initialDeclined}
            revisionRequested={initialRevisionRequested}
            tokens={{
              bodyBg,
              bodyText,
              headingColor,
              muted,
              faint,
              hairline,
              headingFontFamily,
              titleStyle,
              mutedStyle,
            }}
          />
        </Section>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer
        className="px-8 sm:px-14 py-6 flex flex-wrap items-center justify-between gap-3 text-detail tracking-[0.12em] uppercase"
        style={{
          color: muted,
          fontFamily: headingFontFamily,
          borderTop: `1px solid ${hairline}`,
        }}
      >
        <span>
          {displayCompanyName}
          {companyAbn && (
            <span className="ml-3 opacity-70" style={TABULAR}>
              ABN {companyAbn}
            </span>
          )}
        </span>
        <span className="flex items-center gap-4">
          {companyPhone && <span>{companyPhone}</span>}
          {companyEmail && <span>{companyEmail}</span>}
        </span>
      </footer>
    </article>
  );
}
