// components/viewer/QuoteSinglePageView.tsx
// QuoteWin-style single-page quote viewer. Renders cover, trust badges,
// about us, testimonial, scope, line items, total/deposit, next steps and an
// inline accept form — all in one continuous scroll. Used by both the public
// viewer at /view/[token] (for entity_type='quote') and the in-app builder
// preview pane, so what you edit is exactly what the client sees.

'use client';

import { useEffect, useState } from 'react';
import { Star, Check, ShieldCheck } from 'lucide-react';
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
  /** Optional accept handler. When omitted the accept form is hidden (preview mode). */
  onAccept?: (name: string) => Promise<void>;
  /** Already-accepted state — hides the form, shows a confirmation block. */
  accepted?: boolean;
  /** Pre-resolved cover image URL (skip async signed-URL fetch — used for export/preview). */
  resolvedBgUrl?: string | null;
  /** Company name shown on the cover header. */
  companyName?: string;
  /** Company contact line shown on the cover header. */
  companyPhone?: string | null;
  companyEmail?: string | null;
  /** When true, scale typography/padding down for a sidebar preview. */
  compact?: boolean;
}

function buildHeaderBackground(p: Proposal): string {
  if (p.cover_bg_style === 'gradient') {
    const angle = p.cover_gradient_angle ?? 135;
    const c1 = p.cover_bg_color_1 ?? '#0a1f44';
    const c2 = p.cover_bg_color_2 ?? '#1e3a8a';
    return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  }
  return p.cover_bg_color_1 ?? '#0a1f44';
}

/** Find the first percentage milestone — that's the deposit in QuoteWin parlance. */
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
    return { amount, pct, label: first.label || 'Deposit Required' };
  }
  if (sched.one_off?.enabled && sched.one_off.amount > 0) {
    return {
      amount: sched.one_off.amount,
      pct: total > 0 ? Math.round((sched.one_off.amount / total) * 100) : 0,
      label: sched.one_off.label || 'Deposit Required',
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

/* ── Section wrapper — provides the QuoteWin pill+rule styling ─────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {children}
      </span>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="px-6 sm:px-10 py-7 border-b border-gray-100">{children}</div>;
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
  compact,
}: QuoteSinglePageViewProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(resolvedBgUrl ?? null);
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [accepted, setAccepted] = useState(!!initialAccepted);
  const [agree, setAgree] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [accepting, setAccepting] = useState(false);

  // Resolve cover image once
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
  const headerSubtle = proposal.cover_subtitle_color ?? '#cbd5e1';

  const handleAccept = async () => {
    if (!onAccept) return;
    if (!agree || !signerName.trim()) return;
    setAccepting(true);
    try {
      await onAccept(signerName.trim());
      setAccepted(true);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className={`bg-white ${compact ? 'text-[12px]' : 'text-sm'} text-gray-700`}>
      {/* ── Cover header ─────────────────────────────────────────── */}
      <header
        className="relative px-6 sm:px-10 pt-8 pb-12"
        style={{ background: headerBg, color: headerText }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
          <div className="font-semibold text-lg" style={{ color: headerText }}>
            {companyName || branding.name || 'Your Company'}
          </div>
          <div className="text-xs opacity-80 flex items-center gap-3" style={{ color: headerSubtle }}>
            {companyPhone && <span>{companyPhone}</span>}
            {companyEmail && <span>{companyEmail}</span>}
          </div>
        </div>

        {bgUrl && (
          <div
            className="rounded-xl overflow-hidden mb-6 aspect-[16/9] bg-center bg-cover"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
        )}

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-semibold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
          Quote
        </span>
        <h1
          className={`${compact ? 'text-xl' : 'text-3xl'} font-semibold leading-tight mb-6`}
          style={{ color: headerText }}
        >
          {proposal.title || 'Your Project Quote'}
        </h1>

        {/* Prepared For | Project Type | Total bar */}
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-black/20 px-4 py-3 backdrop-blur-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60" style={{ color: headerSubtle }}>
              Prepared For
            </div>
            <div className="text-sm font-medium truncate" style={{ color: headerText }}>
              {proposal.client_name || '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60" style={{ color: headerSubtle }}>
              Project
            </div>
            <div className="text-sm font-medium truncate" style={{ color: headerText }}>
              {proposal.site_address || proposal.title || '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-60" style={{ color: headerSubtle }}>
              Total
            </div>
            <div className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
              {formatAUD(total)}
            </div>
          </div>
        </div>
      </header>

      {/* ── Trust badges ────────────────────────────────────────── */}
      {extras.badges.length > 0 && (
        <div className="px-6 sm:px-10 py-4 flex flex-wrap items-center justify-center gap-2 border-b border-gray-100">
          {extras.badges.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 text-xs font-medium"
            >
              <Check size={11} className="text-emerald-500" />
              {b}
            </span>
          ))}
        </div>
      )}

      {/* ── About Us ────────────────────────────────────────────── */}
      {extras.about_us && (
        <Section>
          <SectionHeader>About Us</SectionHeader>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{extras.about_us}</p>
        </Section>
      )}

      {/* ── Testimonial ─────────────────────────────────────────── */}
      {extras.testimonial && (
        <Section>
          <div className="flex items-center gap-1 mb-2 text-amber-400">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={14} fill="currentColor" stroke="none" />
            ))}
          </div>
          <p className="italic text-gray-700 leading-relaxed mb-2">
            &ldquo;{extras.testimonial}&rdquo;
            {extras.testimonial_author && (
              <span className="not-italic"> {extras.testimonial_author}</span>
            )}
          </p>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400">
            <span className="w-6 h-px bg-blue-300" />
            Verified Client
          </div>
        </Section>
      )}

      {/* ── Scope of works ──────────────────────────────────────── */}
      {proposal.description && (
        <Section>
          <SectionHeader>Scope of Works</SectionHeader>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{proposal.description}</p>
        </Section>
      )}

      {/* ── Breakdown table ─────────────────────────────────────── */}
      {items.length > 0 && (
        <Section>
          <SectionHeader>Breakdown</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-right py-2 font-medium w-16">Qty</th>
                  <th className="text-right py-2 font-medium w-24">Unit</th>
                  <th className="text-right py-2 font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3">
                      <div className="font-medium text-gray-900">{it.label || '—'}</div>
                      {it.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{it.description}</div>
                      )}
                    </td>
                    <td className="py-3 text-right text-gray-600">{it.qty ?? 1}</td>
                    <td className="py-3 text-right text-gray-600">
                      {it.unit_price != null ? formatAUD(it.unit_price) : '—'}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {formatAUD(it.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Total Investment ────────────────────────────────────── */}
      <Section>
        <SectionHeader>Total Investment</SectionHeader>
        <div
          className="rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
          style={{ background: headerBg, color: headerText }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Total Amount</div>
            <div className={`${compact ? 'text-2xl' : 'text-4xl'} font-semibold mt-1`}>
              {formatAUD(total)}
            </div>
            {pricing?.tax_enabled && (
              <div className="text-xs opacity-70 mt-1">
                Incl. {pricing.tax_label || 'GST'} ({formatAUD(taxAmount)})
              </div>
            )}
            {validUntil && (
              <div className="text-xs opacity-70 mt-3">Valid until {validUntil}</div>
            )}
          </div>
          {deposit && (
            <div className="sm:text-right">
              <div className="text-[10px] uppercase tracking-wider opacity-60">{deposit.label}</div>
              <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-semibold mt-1`}>
                {formatAUD(deposit.amount)}
              </div>
              <div className="text-xs opacity-70 mt-1">{deposit.pct}% upfront</div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 italic mt-3">
          All prices include labour, materials, and project management to complete the work as
          described.
        </p>
      </Section>

      {/* ── Next Steps ──────────────────────────────────────────── */}
      <Section>
        <SectionHeader>Next Steps</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: 1, title: 'Review this quote', body: 'Read through the scope, pricing, and terms at your own pace.' },
            { n: 2, title: 'Accept below', body: 'Tick the checkbox, type your name, and click Accept.' },
            { n: 3, title: 'We’ll be in touch', body: "Once confirmed, we'll arrange scheduling and start dates." },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold mb-2">
                {s.n}
              </div>
              <div className="text-sm font-medium text-gray-900 mb-1">{s.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Terms ───────────────────────────────────────────────── */}
      {extras.terms && (
        <Section>
          <SectionHeader>Terms &amp; Conditions</SectionHeader>
          <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-xs">{extras.terms}</p>
        </Section>
      )}

      {/* ── Accept form ─────────────────────────────────────────── */}
      {onAccept && (
        <div className="px-6 sm:px-10 py-10 bg-gray-50">
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 mb-4">
              {accepted ? <Check size={18} /> : <ShieldCheck size={18} />}
            </div>
            {accepted ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Quote Accepted</h3>
                <p className="text-sm text-gray-500">
                  Thanks {signerName || ''} — we&apos;ll be in touch shortly.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Ready to lock in your project?
                </h3>
                <p className="text-sm text-gray-500 mb-5">
                  Sign below to confirm your project and secure your quoted price.
                </p>

                <label className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-left cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-gray-700">
                    I have read and agree to the quote details and terms above.
                  </span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Type your full name to confirm"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm mb-3"
                />
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!agree || !signerName.trim() || accepting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={14} />
                  {accepting ? 'Confirming…' : 'Accept & Confirm Quote'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400 border-t border-gray-100">
        <span className="font-medium text-gray-600">{companyName || branding.name}</span>
        <span className="flex items-center gap-3">
          {companyPhone && <span>{companyPhone}</span>}
          {companyEmail && <span>{companyEmail}</span>}
        </span>
      </footer>
    </div>
  );
}
