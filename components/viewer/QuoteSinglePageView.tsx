// components/viewer/QuoteSinglePageView.tsx
// Single-page quote viewer. Editorial layout — every visible element pulls
// its colour and font from the same three-tier cascade (per-quote → company
// branding → fallback) so the Design tab actually drives the whole document
// and not just headlines.

'use client';

import { useEffect, useState } from 'react';
import { Check, MessageSquare, X } from 'lucide-react';
import {
  supabase,
  type Proposal,
  type ProposalPricing,
  type PricingLineItem,
  type PricingOptionalItem,
  formatAUD,
  pricingEffectiveSubtotal,
} from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { parseQuoteExtras } from '@/lib/types/quote-extras';

interface QuoteSinglePageViewProps {
  proposal: Proposal;
  pricing: ProposalPricing | null;
  branding: CompanyBranding;
  onAccept?: (name: string) => Promise<void>;
  onDecline?: (name: string, reason: string) => Promise<void>;
  onRequestRevision?: (name: string, notes: string) => Promise<void>;
  accepted?: boolean;
  declined?: boolean;
  revisionRequested?: boolean;
  resolvedBgUrl?: string | null;
  companyName?: string;
  companyPhone?: string | null;
  companyEmail?: string | null;
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
  if (p.cover_bg_style === 'gradient') {
    const angle = p.cover_gradient_angle ?? 135;
    return `linear-gradient(${angle}deg, ${p.cover_bg_color_1 ?? '#0f172a'}, ${p.cover_bg_color_2 ?? '#1e293b'})`;
  }
  return p.cover_bg_color_1 ?? '#0f172a';
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
  resolvedBgUrl,
  companyName,
  companyPhone,
  companyEmail,
}: QuoteSinglePageViewProps) {
  const photoPaths = parsePhotos(proposal.project_photos);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [coverImgUrl, setCoverImgUrl] = useState<string | null>(resolvedBgUrl ?? null);
  const extras = parseQuoteExtras(proposal.quote_extras);

  // Decision-state machine — accept / decline / revision are mutually
  // exclusive end states, so a single 'state' field keeps the UI honest.
  type DecisionState = 'pending' | 'accepted' | 'declined' | 'revision';
  const initialState: DecisionState = initialAccepted
    ? 'accepted'
    : initialDeclined
      ? 'declined'
      : initialRevisionRequested
        ? 'revision'
        : 'pending';
  const [state, setState] = useState<DecisionState>(initialState);
  const [activeAction, setActiveAction] = useState<'accept' | 'decline' | 'revision'>('accept');
  const [agree, setAgree] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const items: PricingLineItem[] = pricing?.items ?? [];
  const optionalItems: PricingOptionalItem[] = pricing?.optional_items ?? [];
  const subtotal = pricingEffectiveSubtotal(items);
  const taxRate = pricing?.tax_enabled ? (pricing.tax_rate ?? 10) : 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount;
  const deposit = deriveDeposit(pricing, total);
  const validUntil = formatValidUntil(pricing);

  /* ── Cover header tokens ───────────────────────────────────── */

  const headerBg = buildHeaderBackground(proposal);
  const headerText = proposal.cover_text_color ?? '#ffffff';
  const headerSubtle = proposal.cover_subtitle_color ?? withAlpha(headerText, 0.55);
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

  /* ── Section primitives bound to the resolved tokens ─────── */

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={labelStyle}>{children}</div>
  );
  const Section = ({ children }: { children: React.ReactNode }) => (
    <section className="px-8 sm:px-14 py-10 print:py-7">{children}</section>
  );
  const Hairline = () => (
    <div className="mx-8 sm:mx-14 print:mx-0" style={{ height: 1, backgroundColor: hairline }} />
  );

  /* ── Photo positioning ─────────────────────────────────────── */

  const heroUrl = photoPaths[0] ? photoUrls[photoPaths[0]] : coverImgUrl;
  const featureUrl = photoPaths[1] ? photoUrls[photoPaths[1]] : null;

  /* ── Decision actions ──────────────────────────────────────── */

  const showDecisionButtons = state === 'pending' && (onAccept || onDecline || onRequestRevision);

  const submit = async () => {
    if (submitting) return;
    if (!signerName.trim()) return;
    setSubmitting(true);
    try {
      if (activeAction === 'accept' && onAccept) {
        if (!agree) return;
        await onAccept(signerName.trim());
        setState('accepted');
      } else if (activeAction === 'decline' && onDecline) {
        await onDecline(signerName.trim(), reason.trim());
        setState('declined');
      } else if (activeAction === 'revision' && onRequestRevision) {
        if (!reason.trim()) return;
        await onRequestRevision(signerName.trim(), reason.trim());
        setState('revision');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <article style={articleStyle}>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <header
        className="relative px-8 sm:px-14 pt-10 pb-12"
        style={{ background: headerBg, color: headerText }}
      >
        <div
          className="flex items-center justify-between text-[11px] tracking-[0.12em] uppercase mb-12 opacity-80"
          style={{ fontFamily: headingFontFamily }}
        >
          <span style={{ color: headerText }}>{displayCompanyName}</span>
          <span className="flex items-center gap-4" style={{ color: headerSubtle }}>
            {companyPhone && <span>{companyPhone}</span>}
            {companyEmail && <span>{companyEmail}</span>}
          </span>
        </div>

        {heroUrl && (
          <div
            className="rounded-sm overflow-hidden mb-12 aspect-[16/7] bg-center bg-cover"
            style={{ backgroundImage: `url(${heroUrl})` }}
          />
        )}

        <div
          className="text-[10px] tracking-[0.22em] uppercase opacity-60 mb-4"
          style={{ color: headerSubtle, fontFamily: headingFontFamily }}
        >
          Quote
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
          className="flex items-end justify-between gap-6 pt-6"
          style={{ borderTop: `1px solid ${withAlpha(headerText, 0.1)}` }}
        >
          <div className="min-w-0">
            <div
              className="text-[10px] tracking-[0.22em] uppercase opacity-60 mb-1"
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
          <div className="text-right">
            <div
              className="text-[10px] tracking-[0.22em] uppercase opacity-60 mb-1"
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
              {formatAUD(total)}
            </div>
          </div>
        </div>
      </header>

      {/* ── Trust line ────────────────────────────────────────── */}
      {extras.badges.length > 0 && (
        <div
          className="px-8 sm:px-14 py-5 text-[11px] tracking-[0.16em] uppercase text-center"
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

      {/* ── About Us ──────────────────────────────────────────── */}
      {extras.about_us && (
        <>
          <Section>
            <SectionLabel>About</SectionLabel>
            <p className="leading-[1.7] whitespace-pre-wrap max-w-2xl">{extras.about_us}</p>
          </Section>
          <Hairline />
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
          <Hairline />
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
          <Hairline />
        </>
      )}

      {/* ── Scope of Works ────────────────────────────────────── */}
      {proposal.description && (
        <>
          <Section>
            <SectionLabel>Scope of Works</SectionLabel>
            <p className="leading-[1.7] whitespace-pre-wrap max-w-2xl">{proposal.description}</p>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Breakdown ─────────────────────────────────────────── */}
      {items.length > 0 && (
        <>
          <Section>
            <SectionLabel>Breakdown</SectionLabel>
            <table className="w-full" style={TABULAR}>
              <thead>
                <tr
                  className="text-[10px] tracking-[0.18em] uppercase"
                  style={{
                    color: faint,
                    fontFamily: headingFontFamily,
                    borderBottom: `1px solid ${hairline}`,
                  }}
                >
                  <th className="text-left py-3 font-medium">Item</th>
                  <th className="text-right py-3 font-medium w-16">Qty</th>
                  <th className="text-right py-3 font-medium w-24">Unit</th>
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
                        <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: muted }}>
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right text-[14px]" style={{ color: muted }}>
                      {it.qty ?? 1}
                    </td>
                    <td className="py-4 text-right text-[14px]" style={{ color: muted }}>
                      {it.unit_price != null ? formatAUD(it.unit_price) : '—'}
                    </td>
                    <td className="py-4 text-right text-[15px]" style={{ color: bodyText }}>
                      {formatAUD(it.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Optional Add-Ons ──────────────────────────────────── */}
      {optionalItems.length > 0 && (
        <>
          <Section>
            <SectionLabel>Optional Add-Ons</SectionLabel>
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
                        <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: muted }}>
                          {it.description}
                        </div>
                      )}
                    </div>
                    <div className="text-[15px] shrink-0" style={{ color: bodyText, ...TABULAR }}>
                      {formatAUD(eff)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Investment ────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Investment</SectionLabel>
        <div style={{ border: `1px solid ${hairline}`, borderRadius: 4 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div
              className="px-6 py-7"
              style={{ borderBottom: `1px solid ${hairline}` }}
            >
              <div style={labelStyle}>Total</div>
              <div
                className="tracking-tight"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3rem)',
                  color: headingColor,
                  fontFamily: titleFontFamily,
                  fontWeight: Number(titleFontWeight) || 600,
                  ...TABULAR,
                }}
              >
                {formatAUD(total)}
              </div>
              {pricing?.tax_enabled && (
                <div className="text-xs mt-2" style={{ color: muted }}>
                  Includes {pricing.tax_label || 'GST'} of {formatAUD(taxAmount)}
                </div>
              )}
            </div>
            {deposit ? (
              <div
                className="px-6 py-7"
                style={{
                  borderBottom: `1px solid ${hairline}`,
                  borderLeft: `1px solid ${hairline}`,
                }}
              >
                <div style={labelStyle}>{deposit.label}</div>
                <div
                  className="tracking-tight"
                  style={{
                    fontSize: 'clamp(2.25rem, 4vw, 3rem)',
                    color: headingColor,
                    fontFamily: titleFontFamily,
                    fontWeight: Number(titleFontWeight) || 600,
                    ...TABULAR,
                  }}
                >
                  {formatAUD(deposit.amount)}
                </div>
                <div className="text-xs mt-2" style={{ color: muted }}>
                  {deposit.pct}% upfront
                </div>
              </div>
            ) : (
              <div
                className="px-6 py-7 flex items-center text-xs"
                style={{
                  color: muted,
                  borderLeft: `1px solid ${hairline}`,
                }}
              >
                No deposit required.
              </div>
            )}
          </div>
        </div>
        {validUntil && (
          <div className="text-xs mt-4" style={{ color: muted }}>
            Valid until {validUntil}.
          </div>
        )}
      </Section>
      <Hairline />

      {/* ── Next Steps ────────────────────────────────────────── */}
      {extras.next_steps.length > 0 && (
        <>
          <Section>
            <SectionLabel>Next Steps</SectionLabel>
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
          <Hairline />
        </>
      )}

      {/* ── Terms ─────────────────────────────────────────────── */}
      {extras.terms && (
        <>
          <Section>
            <SectionLabel>Terms</SectionLabel>
            <p
              className="text-[12.5px] whitespace-pre-wrap leading-[1.7] max-w-2xl"
              style={{ color: muted }}
            >
              {extras.terms}
            </p>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Decision form ─────────────────────────────────────── */}
      {(onAccept || onDecline || onRequestRevision) && (
        <Section>
          <div className="max-w-md mx-auto text-center py-6 print:hidden">
            {state === 'accepted' && (
              <>
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-5"
                  style={{ backgroundColor: headingColor, color: bodyBg }}
                >
                  <Check size={16} />
                </div>
                <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
                  Quote Accepted
                </h3>
                <p className="text-sm" style={mutedStyle}>
                  Thanks {signerName || ''} — we&apos;ll be in touch shortly.
                </p>
              </>
            )}

            {state === 'declined' && (
              <>
                <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
                  Quote Declined
                </h3>
                <p className="text-sm" style={mutedStyle}>
                  Noted — thanks for letting us know{signerName ? `, ${signerName}` : ''}.
                </p>
              </>
            )}

            {state === 'revision' && (
              <>
                <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
                  Revision Requested
                </h3>
                <p className="text-sm" style={mutedStyle}>
                  We&apos;ve been notified and will get back to you shortly.
                </p>
              </>
            )}

            {state === 'pending' && (
              <>
                <h3
                  className="text-2xl sm:text-3xl tracking-tight mb-2"
                  style={titleStyle}
                >
                  {activeAction === 'accept'
                    ? 'Ready to lock in your project?'
                    : activeAction === 'decline'
                      ? 'Decline this quote?'
                      : 'Request changes to this quote?'}
                </h3>
                <p className="text-sm mb-6" style={mutedStyle}>
                  {activeAction === 'accept'
                    ? 'Sign below to confirm your project and secure your quoted price.'
                    : activeAction === 'decline'
                      ? "Let us know why if you'd like — it helps us improve."
                      : "Tell us what you'd like changed and we'll send a revised quote."}
                </p>

                {/* Action toggle */}
                {showDecisionButtons && (
                  <div
                    className="inline-flex rounded-lg p-1 mb-5 text-xs"
                    style={{ backgroundColor: withAlpha(bodyText, 0.05) }}
                  >
                    {onAccept && (
                      <button
                        type="button"
                        onClick={() => setActiveAction('accept')}
                        className={`px-3 py-1.5 rounded-md transition-colors ${activeAction === 'accept' ? 'shadow-sm' : ''}`}
                        style={
                          activeAction === 'accept'
                            ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                            : { color: muted }
                        }
                      >
                        Accept
                      </button>
                    )}
                    {onRequestRevision && (
                      <button
                        type="button"
                        onClick={() => setActiveAction('revision')}
                        className={`px-3 py-1.5 rounded-md transition-colors ${activeAction === 'revision' ? 'shadow-sm' : ''}`}
                        style={
                          activeAction === 'revision'
                            ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                            : { color: muted }
                        }
                      >
                        Request Changes
                      </button>
                    )}
                    {onDecline && (
                      <button
                        type="button"
                        onClick={() => setActiveAction('decline')}
                        className={`px-3 py-1.5 rounded-md transition-colors ${activeAction === 'decline' ? 'shadow-sm' : ''}`}
                        style={
                          activeAction === 'decline'
                            ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                            : { color: muted }
                        }
                      >
                        Decline
                      </button>
                    )}
                  </div>
                )}

                {activeAction === 'accept' && (
                  <label
                    className="flex items-start gap-3 mb-5 text-left text-[13px] px-4 py-3 rounded-lg"
                    style={{
                      border: `1px solid ${hairline}`,
                      backgroundColor: bodyBg,
                      color: bodyText,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>I have read and agree to the proposal details and terms above.</span>
                  </label>
                )}

                {activeAction !== 'accept' && (
                  <div className="text-left mb-5">
                    <label
                      className="block text-[10px] tracking-[0.18em] uppercase mb-1.5"
                      style={{ color: faint, fontFamily: headingFontFamily }}
                    >
                      {activeAction === 'revision' ? 'What changes do you need?' : 'Reason (optional)'}
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder={
                        activeAction === 'revision'
                          ? 'e.g. Could you split the bathroom into two phases?'
                          : 'e.g. Going with another quote for now.'
                      }
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
                      style={{
                        border: `1px solid ${hairline}`,
                        backgroundColor: bodyBg,
                        color: bodyText,
                      }}
                    />
                  </div>
                )}

                <div className="text-left mb-6">
                  <label
                    className="block text-[10px] tracking-[0.18em] uppercase mb-1.5"
                    style={{ color: faint, fontFamily: headingFontFamily }}
                  >
                    Type your full name to confirm
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
                    style={{
                      border: `1px solid ${hairline}`,
                      backgroundColor: bodyBg,
                      color: bodyText,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    submitting ||
                    !signerName.trim() ||
                    (activeAction === 'accept' && !agree) ||
                    (activeAction === 'revision' && !reason.trim())
                  }
                  className="w-full px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  style={{
                    backgroundColor:
                      activeAction === 'decline'
                        ? withAlpha('#dc2626', 0.85)
                        : headingColor,
                    color: bodyBg,
                  }}
                >
                  {activeAction === 'accept' && <Check size={14} />}
                  {activeAction === 'revision' && <MessageSquare size={14} />}
                  {activeAction === 'decline' && <X size={14} />}
                  {submitting
                    ? 'Submitting…'
                    : activeAction === 'accept'
                      ? 'Accept & Confirm Quote'
                      : activeAction === 'revision'
                        ? 'Request Changes'
                        : 'Decline Quote'}
                </button>
              </>
            )}
          </div>
        </Section>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer
        className="px-8 sm:px-14 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] tracking-[0.12em] uppercase"
        style={{
          color: muted,
          fontFamily: headingFontFamily,
          borderTop: `1px solid ${hairline}`,
        }}
      >
        <span>{displayCompanyName}</span>
        <span className="flex items-center gap-4">
          {companyPhone && <span>{companyPhone}</span>}
          {companyEmail && <span>{companyEmail}</span>}
        </span>
      </footer>
    </article>
  );
}
