// components/viewer/PricingPage.tsx
'use client';

import {
  ProposalPricing, PaymentSchedule, MilestonePayment,
  formatAUD, pricingSubtotal, pricingTax,
  normalizePaymentSchedule, milestoneAmount,
} from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor, deriveSurfaceColor } from '@/hooks/useProposal';

interface PricingPageProps {
  pricing: ProposalPricing;
  branding: CompanyBranding;
  clientName?: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getExpiryDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'week',
  fortnightly: 'fortnight',
  monthly: 'month',
  quarterly: 'quarter',
  annually: 'year',
};

export default function PricingPage({ pricing, branding, clientName }: PricingPageProps) {
  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const textColor = branding.sidebar_text_color || '#ffffff';
  const border = deriveBorderColor(bgSecondary);
  const surface = deriveSurfaceColor(bgPrimary, bgSecondary);

  const subtotal = pricingSubtotal(pricing.items);
  const tax = pricing.tax_enabled ? pricingTax(subtotal, pricing.tax_rate) : 0;
  const total = subtotal + tax;

  const muted = `${textColor}99`;
  const faint = `${textColor}55`;

  // Per-item GST helper
  const itemTax = (amount: number) =>
    pricing.tax_enabled ? Math.round(amount * (pricing.tax_rate / 100) * 100) / 100 : 0;

  // Payment schedule — handles both old deposit/balance and new milestones format
  const ps = pricing.payment_schedule
    ? normalizePaymentSchedule(pricing.payment_schedule)
    : null;
  const hasPaymentSchedule = ps && (ps.one_off?.enabled || ps.milestones?.enabled || ps.recurring?.enabled);

  return (
    <div
      className="w-full min-h-full flex items-start justify-center py-8 lg:py-12 px-4 sm:px-6"
      style={{ backgroundColor: bgPrimary }}
    >
      <div
        className="w-full max-w-[700px] rounded-xl overflow-hidden"
        style={{ backgroundColor: bgSecondary, border: `1px solid ${border}` }}
      >
        {/* Header accent bar */}
        <div className="h-1" style={{ backgroundColor: accent }} />

        <div className="p-6 sm:p-8 lg:p-10">
          {/* Title */}
          <div className="mb-6">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]"
              style={{ color: textColor }}
            >
              {pricing.title}
            </h1>
            {clientName && (
              <p className="text-sm mt-1.5" style={{ color: muted }}>
                Prepared for {clientName}
              </p>
            )}
          </div>

          {/* Intro text */}
          {pricing.intro_text && (
            <p className="text-sm leading-relaxed mb-8" style={{ color: muted }}>
              {pricing.intro_text}
            </p>
          )}

          {/* Line items table */}
          {pricing.items.length > 0 && (
            <div className="mb-6">
              {/* Table header */}
              <div
                className="flex items-center gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg"
                style={{ backgroundColor: surface, color: faint }}
              >
                <span className="flex-1">Description</span>
                <span className="w-24 text-right shrink-0">Amount</span>
                {pricing.tax_enabled && (
                  <span className="w-24 text-right shrink-0">{pricing.tax_label.split('(')[0].trim()}</span>
                )}
                <span className="w-28 text-right shrink-0">
                  {pricing.tax_enabled ? 'Inc. Tax' : 'Total'}
                </span>
              </div>

              {/* Rows */}
              {pricing.items
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item, idx) => {
                  const gst = itemTax(item.amount);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 px-4 py-3.5"
                      style={{
                        borderBottom: `1px solid ${border}`,
                        backgroundColor: idx % 2 === 1 ? `${surface}80` : 'transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: textColor }}>
                          {item.label}
                        </span>
                        {item.description && (
                          <span className="text-xs ml-2" style={{ color: muted }}>
                            {item.description}
                          </span>
                        )}
                      </div>
                      <span className="w-24 text-right shrink-0 text-sm" style={{ color: muted }}>
                        {formatAUD(item.amount)}
                      </span>
                      {pricing.tax_enabled && (
                        <span className="w-24 text-right shrink-0 text-sm" style={{ color: muted }}>
                          {formatAUD(gst)}
                        </span>
                      )}
                      <span className="w-28 text-right shrink-0 text-sm font-medium" style={{ color: textColor }}>
                        {formatAUD(pricing.tax_enabled ? item.amount + gst : item.amount)}
                      </span>
                    </div>
                  );
                })}

              {/* Subtotal / Tax / Total */}
              <div className="rounded-b-lg overflow-hidden" style={{ backgroundColor: surface }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                  <span className="text-sm" style={{ color: muted }}>Subtotal</span>
                  <span className="text-sm font-semibold" style={{ color: textColor }}>{formatAUD(subtotal)}</span>
                </div>
                {pricing.tax_enabled && (
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                    <span className="text-sm" style={{ color: muted }}>{pricing.tax_label}</span>
                    <span className="text-sm font-semibold" style={{ color: textColor }}>{formatAUD(tax)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-4">
                  <span className="text-base font-bold" style={{ color: textColor }}>
                    Total{pricing.tax_enabled ? ' (inc. tax)' : ''}
                  </span>
                  <span className="text-xl font-bold" style={{ color: accent }}>{formatAUD(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Payment Schedule ──────────────────────────────────── */}
          {hasPaymentSchedule && ps && (
            <div className="mb-8">
              <h3
                className="text-sm font-semibold mb-3 uppercase tracking-wider"
                style={{ color: faint }}
              >
                Payment Schedule
              </h3>
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: `1px solid ${border}` }}
              >
                {/* One-off payment */}
                {ps.one_off?.enabled && ps.one_off.amount > 0 && (
                  <div
                    className="flex items-center justify-between px-4 py-4"
                    style={{ borderBottom: (ps.milestones?.enabled || ps.recurring?.enabled) ? `1px solid ${border}` : undefined }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: accent }}
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-medium" style={{ color: textColor }}>
                          {ps.one_off.label}
                        </span>
                        {ps.one_off.note && (
                          <p className="text-xs mt-0.5" style={{ color: muted }}>
                            {ps.one_off.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold shrink-0 ml-4" style={{ color: accent }}>
                      {formatAUD(ps.one_off.amount)}
                    </span>
                  </div>
                )}

                {/* Milestone payments */}
                {ps.milestones?.enabled && ps.milestones.payments.length > 0 && (
                  <>
                    {ps.milestones.payments.map((payment, idx) => {
                      const amt = milestoneAmount(payment, total);
                      const isLast = idx === ps.milestones.payments.length - 1;
                      const hasRecurringAfter = ps.recurring?.enabled;
                      // Gradient opacity from full accent to lighter
                      const opacity = 1 - (idx / Math.max(1, ps.milestones.payments.length - 1)) * 0.6;
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between px-4 py-4"
                          style={{
                            borderBottom: (!isLast || hasRecurringAfter) ? `1px solid ${border}` : undefined,
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: accent, opacity }}
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-medium" style={{ color: textColor }}>
                                {payment.label}
                              </span>
                              {payment.note && (
                                <p className="text-xs mt-0.5" style={{ color: muted }}>
                                  {payment.note}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className="text-sm font-bold shrink-0 ml-4"
                            style={{ color: idx === 0 ? accent : textColor }}
                          >
                            {formatAUD(amt)}
                          </span>
                        </div>
                      );
                    })}

                    {/* Milestone visual progress bar */}
                    {total > 0 && (
                      <div className="px-4 py-3" style={{ backgroundColor: surface }}>
                        <div
                          className="flex rounded-full h-2 overflow-hidden"
                          style={{ backgroundColor: `${textColor}15` }}
                        >
                          {ps.milestones.payments.map((payment, idx) => {
                            const amt = milestoneAmount(payment, total);
                            const pct = Math.min(100, (amt / total) * 100);
                            const opacity = 1 - (idx / Math.max(1, ps.milestones.payments.length - 1)) * 0.6;
                            return (
                              <div
                                key={payment.id}
                                className="transition-all duration-300"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: accent,
                                  opacity,
                                  borderRight: idx < ps.milestones.payments.length - 1
                                    ? '1px solid rgba(0,0,0,0.15)'
                                    : undefined,
                                }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px]" style={{ color: faint }}>
                            {ps.milestones.payments[0]?.label} — {formatAUD(milestoneAmount(ps.milestones.payments[0], total))}
                          </span>
                          {ps.milestones.payments.length > 1 && (
                            <span className="text-[10px]" style={{ color: faint }}>
                              {ps.milestones.payments[ps.milestones.payments.length - 1]?.label} — {formatAUD(milestoneAmount(ps.milestones.payments[ps.milestones.payments.length - 1], total))}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Recurring */}
                {ps.recurring?.enabled && ps.recurring.amount > 0 && (
                  <div className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium" style={{ color: textColor }}>
                          {ps.recurring.label}
                        </span>
                        {ps.recurring.note && (
                          <p className="text-xs mt-0.5" style={{ color: muted }}>
                            {ps.recurring.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold shrink-0 ml-4" style={{ color: accent }}>
                      {formatAUD(ps.recurring.amount)}/{FREQ_LABELS[ps.recurring.frequency] || ps.recurring.frequency}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optional extras */}
          {pricing.optional_items.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: faint }}>
                Optional Extras
              </h3>
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${border}` }}>
                {pricing.optional_items
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-3"
                      style={{
                        borderBottom: idx < pricing.optional_items.length - 1 ? `1px solid ${border}` : undefined,
                        backgroundColor: idx % 2 === 0 ? 'transparent' : `${surface}80`,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: textColor }}>{item.label}</span>
                        {item.description && (
                          <span className="text-xs ml-2" style={{ color: muted }}>{item.description}</span>
                        )}
                      </div>
                      <span className="text-sm font-medium shrink-0 ml-4" style={{ color: textColor }}>
                        {formatAUD(item.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Quote validity */}
          {pricing.validity_days && pricing.proposal_date && (
            <div
              className="rounded-lg px-4 py-3 text-xs flex items-center justify-between"
              style={{ backgroundColor: surface, color: muted }}
            >
              <span>
                Quote valid for {pricing.validity_days} days from {formatDate(pricing.proposal_date)}
              </span>
              <span className="font-medium" style={{ color: textColor }}>
                Expires {getExpiryDate(pricing.proposal_date, pricing.validity_days)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}