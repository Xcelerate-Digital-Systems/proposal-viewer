// components/viewer/QuoteSinglePageView.tsx
// Single-page quote viewer. Editorial, restrained — leans on a serif display
// face, hairline dividers and tabular numerals to feel like a premium printed
// document rather than a SaaS template. Used by both the public viewer at
// /view/[token] (entity_type='quote') and the in-app builder preview pane.

'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  supabase,
  type Proposal,
  type ProposalPricing,
  type PricingLineItem,
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
  accepted?: boolean;
  resolvedBgUrl?: string | null;
  companyName?: string;
  companyPhone?: string | null;
  companyEmail?: string | null;
  /** Reserved for future use — currently no compact-specific styling. */
  compact?: boolean;
}

/* ── Style tokens ───────────────────────────────────────────────────────── */

// System serif stack — Iowan on Apple, Source Serif/Garamond elsewhere.
// Cheap, no font load, still feels editorial.
const SERIF =
  "'Iowan Old Style', 'Apple Garamond', 'Source Serif Pro', Garamond, 'Times New Roman', Georgia, serif";

const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/* ── Helpers ────────────────────────────────────────────────────────────── */

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

/* ── Section primitives ─────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium tracking-[0.18em] uppercase text-faint mb-3">
      {children}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="px-8 sm:px-14 py-10">{children}</section>;
}

function Hairline() {
  return <div className="h-px bg-edge mx-8 sm:mx-14" />;
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function QuoteSinglePageView({
  proposal,
  pricing,
  branding,
  onAccept,
  accepted: initialAccepted,
  resolvedBgUrl,
  companyName,
  companyPhone,
  companyEmail,
}: QuoteSinglePageViewProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(resolvedBgUrl ?? null);
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [accepted, setAccepted] = useState(!!initialAccepted);
  const [agree, setAgree] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (resolvedBgUrl !== undefined && resolvedBgUrl !== null) return;
    if (!proposal.cover_image_path) return;
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(proposal.cover_image_path, 3600)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.signedUrl) setBgUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [proposal.cover_image_path, resolvedBgUrl]);

  const items: PricingLineItem[] = pricing?.items ?? [];
  const subtotal = pricingEffectiveSubtotal(items);
  const taxRate = pricing?.tax_enabled ? (pricing.tax_rate ?? 10) : 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount;
  const deposit = deriveDeposit(pricing, total);
  const validUntil = formatValidUntil(pricing);

  const headerBg = buildHeaderBackground(proposal);
  const headerText = proposal.cover_text_color ?? '#ffffff';
  const headerSubtle = proposal.cover_subtitle_color ?? 'rgba(255,255,255,0.55)';
  const displayCompanyName = companyName || branding.name;

  const handleAccept = async () => {
    if (!onAccept || !agree || !signerName.trim()) return;
    setAccepting(true);
    try {
      await onAccept(signerName.trim());
      setAccepted(true);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <article className="bg-paper text-ink" style={TABULAR}>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <header
        className="relative px-8 sm:px-14 pt-10 pb-12"
        style={{ background: headerBg, color: headerText }}
      >
        {/* Top meta row */}
        <div className="flex items-center justify-between text-[11px] tracking-[0.12em] uppercase mb-12 opacity-80">
          <span style={{ color: headerText }}>{displayCompanyName}</span>
          <span className="flex items-center gap-4" style={{ color: headerSubtle }}>
            {companyPhone && <span>{companyPhone}</span>}
            {companyEmail && <span>{companyEmail}</span>}
          </span>
        </div>

        {/* Optional photo */}
        {bgUrl && (
          <div
            className="rounded-sm overflow-hidden mb-12 aspect-[16/7] bg-center bg-cover"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
        )}

        {/* Display title */}
        <div className="text-[10px] tracking-[0.22em] uppercase opacity-60 mb-4" style={{ color: headerSubtle }}>
          Proposal &amp; Quote
        </div>
        <h1
          className="font-normal leading-[1.05] mb-10 max-w-3xl"
          style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', color: headerText }}
        >
          {proposal.title || 'Your Project Quote'}
        </h1>

        {/* Bottom meta — prepared for / total */}
        <div className="flex items-end justify-between gap-6 pt-6 border-t border-white/10">
          <div>
            <div className="text-[10px] tracking-[0.22em] uppercase opacity-60 mb-1" style={{ color: headerSubtle }}>
              Prepared for
            </div>
            <div className="text-base" style={{ color: headerText }}>
              {proposal.client_name || '—'}
            </div>
            {proposal.site_address && (
              <div className="text-xs opacity-70 mt-0.5" style={{ color: headerSubtle }}>
                {proposal.site_address}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.22em] uppercase opacity-60 mb-1" style={{ color: headerSubtle }}>
              Total
            </div>
            <div
              className="font-normal"
              style={{ fontFamily: SERIF, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: headerText, ...TABULAR }}
            >
              {formatAUD(total)}
            </div>
          </div>
        </div>
      </header>

      {/* ── Trust line ────────────────────────────────────────── */}
      {extras.badges.length > 0 && (
        <div className="px-8 sm:px-14 py-5 text-[11px] tracking-[0.16em] uppercase text-muted text-center border-b border-edge">
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
            <p className="text-ink/80 leading-[1.7] whitespace-pre-wrap max-w-2xl">{extras.about_us}</p>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Testimonial — editorial pull-quote ────────────────── */}
      {extras.testimonial && (
        <>
          <Section>
            <blockquote
              className="italic text-ink/85 leading-[1.5] max-w-2xl"
              style={{ fontFamily: SERIF, fontSize: 'clamp(1.125rem, 1.6vw, 1.5rem)' }}
            >
              &ldquo;{extras.testimonial}&rdquo;
            </blockquote>
            {extras.testimonial_author && (
              <div className="mt-4 text-xs tracking-[0.14em] uppercase text-muted">
                {extras.testimonial_author.replace(/^[—-]\s*/, '— ')}
              </div>
            )}
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Scope of Works ────────────────────────────────────── */}
      {proposal.description && (
        <>
          <Section>
            <SectionLabel>Scope of Works</SectionLabel>
            <p className="text-ink/80 leading-[1.7] whitespace-pre-wrap max-w-2xl">
              {proposal.description}
            </p>
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
                <tr className="text-[10px] tracking-[0.18em] uppercase text-faint border-b border-edge">
                  <th className="text-left py-3 font-medium">Item</th>
                  <th className="text-right py-3 font-medium w-16">Qty</th>
                  <th className="text-right py-3 font-medium w-24">Unit</th>
                  <th className="text-right py-3 font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-edge/70 last:border-0 align-top">
                    <td className="py-4 pr-6">
                      <div className="text-[15px] text-ink">{it.label || '—'}</div>
                      {it.description && (
                        <div className="text-[12.5px] text-muted mt-1 leading-relaxed">
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right text-[14px] text-ink/70">{it.qty ?? 1}</td>
                    <td className="py-4 text-right text-[14px] text-ink/70">
                      {it.unit_price != null ? formatAUD(it.unit_price) : '—'}
                    </td>
                    <td className="py-4 text-right text-[15px] text-ink">{formatAUD(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Investment ────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Investment</SectionLabel>
        <div className="border border-edge rounded-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-edge">
            <div className="px-6 py-7">
              <div className="text-[10px] tracking-[0.18em] uppercase text-faint mb-2">Total</div>
              <div
                className="font-normal text-ink"
                style={{ fontFamily: SERIF, fontSize: 'clamp(2.25rem, 4vw, 3rem)', ...TABULAR }}
              >
                {formatAUD(total)}
              </div>
              {pricing?.tax_enabled && (
                <div className="text-xs text-muted mt-2">
                  Includes {pricing.tax_label || 'GST'} of {formatAUD(taxAmount)}
                </div>
              )}
            </div>
            {deposit ? (
              <div className="px-6 py-7">
                <div className="text-[10px] tracking-[0.18em] uppercase text-faint mb-2">
                  {deposit.label}
                </div>
                <div
                  className="font-normal text-ink"
                  style={{ fontFamily: SERIF, fontSize: 'clamp(2.25rem, 4vw, 3rem)', ...TABULAR }}
                >
                  {formatAUD(deposit.amount)}
                </div>
                <div className="text-xs text-muted mt-2">{deposit.pct}% upfront</div>
              </div>
            ) : (
              <div className="px-6 py-7 flex items-center text-xs text-muted">
                No deposit required.
              </div>
            )}
          </div>
        </div>
        {validUntil && (
          <div className="text-xs text-muted mt-4">Valid until {validUntil}.</div>
        )}
      </Section>
      <Hairline />

      {/* ── Next Steps ────────────────────────────────────────── */}
      {extras.next_steps.length > 0 && (
        <>
          <Section>
            <SectionLabel>Next Steps</SectionLabel>
            <ol className="space-y-3 text-[15px] text-ink/85 max-w-xl">
              {extras.next_steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="text-faint text-xs tracking-[0.1em] mt-1 w-6 shrink-0">
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
            <p className="text-[12.5px] text-muted whitespace-pre-wrap leading-[1.7] max-w-2xl">
              {extras.terms}
            </p>
          </Section>
          <Hairline />
        </>
      )}

      {/* ── Accept ────────────────────────────────────────────── */}
      {onAccept && (
        <Section>
          <div className="max-w-md mx-auto text-center py-6">
            {accepted ? (
              <>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink text-paper mb-5">
                  <Check size={16} />
                </div>
                <h3
                  className="text-2xl text-ink font-normal mb-2"
                  style={{ fontFamily: SERIF }}
                >
                  Quote Accepted
                </h3>
                <p className="text-sm text-muted">
                  Thanks {signerName || ''} — we&apos;ll be in touch shortly.
                </p>
              </>
            ) : (
              <>
                <h3
                  className="text-3xl text-ink font-normal mb-2"
                  style={{ fontFamily: SERIF }}
                >
                  Ready to begin?
                </h3>
                <p className="text-sm text-muted mb-8">
                  Type your full name below — that's your signature on this quote.
                </p>

                <label className="flex items-start gap-3 mb-5 text-left text-[13px] text-ink/70">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-1 accent-ink"
                  />
                  <span>I have read and agree to the scope, pricing and terms above.</span>
                </label>

                <div className="relative mb-6">
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-ink/30 text-center text-lg focus:outline-none focus:border-ink"
                    style={{ fontFamily: SERIF }}
                  />
                  <div className="text-[10px] tracking-[0.22em] uppercase text-faint mt-2">
                    Signature
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!agree || !signerName.trim() || accepting}
                  className="w-full px-6 py-3.5 rounded-sm bg-ink text-paper text-sm tracking-[0.1em] uppercase hover:bg-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {accepting ? 'Confirming…' : 'Accept Quote'}
                </button>
              </>
            )}
          </div>
        </Section>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="px-8 sm:px-14 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] tracking-[0.12em] uppercase text-muted border-t border-edge">
        <span>{displayCompanyName}</span>
        <span className="flex items-center gap-4">
          {companyPhone && <span>{companyPhone}</span>}
          {companyEmail && <span>{companyEmail}</span>}
        </span>
      </footer>
    </article>
  );
}
