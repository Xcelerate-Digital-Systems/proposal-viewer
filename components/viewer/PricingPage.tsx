// components/viewer/PricingPage.tsx
'use client';

import {
  ProposalPricing, PaymentSchedule, MilestonePayment,
  formatAUD, pricingEffectiveSubtotal, pricingSubtotal, pricingTotalDiscount, pricingTax,
  normalizePaymentSchedule, milestoneAmount, effectiveItemAmount,
} from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor, deriveSurfaceColor } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';


interface PricingPageProps {
  pricing: ProposalPricing;
  branding: CompanyBranding;
  clientName?: string;
  orientation?: 'portrait' | 'landscape';
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

function isQuoteExpired(dateStr: string, days: number): boolean {
  const expiry = new Date(dateStr + 'T00:00:00');
  expiry.setDate(expiry.getDate() + days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today > expiry;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'week',
  fortnightly: 'fortnight',
  monthly: 'month',
  quarterly: 'quarter',
  annually: 'year',
};

export default function PricingPage({ pricing, branding, clientName, orientation }: PricingPageProps) {
  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#01434A';
  const textColor = branding.sidebar_text_color || '#ffffff';
  const border = deriveBorderColor(bgSecondary);
  const surface = deriveSurfaceColor(bgPrimary, bgSecondary);

  const baseSubtotal = pricingSubtotal(pricing.items);
  const totalDiscount = pricingTotalDiscount(pricing.items);
  const subtotal = pricingEffectiveSubtotal(pricing.items);
  const tax = pricing.tax_enabled ? pricingTax(subtotal, pricing.tax_rate) : 0;
  const total = subtotal + tax;

  const muted = `${textColor}99`;
  const faint = `${textColor}55`;

  // Proposal-level pricing colour overrides (set via the Design tab > Pricing
  // card). Each falls back to the current derived colour so the page keeps
  // rendering correctly for older rows / templates that haven't customised.
  const pricingHeaderTextColor = branding.pricing_header_text_color || textColor;
  const pricingTextColor = branding.pricing_text_color || muted;
  const pricingPriceTitleColor = branding.pricing_price_title_color || textColor;
  const pricingPriceColor = branding.pricing_price_color || textColor;
  const pricingPaymentScheduleNameColor = branding.pricing_payment_schedule_name_color || accent;
  const pricingPaymentSchedulePriceColor = branding.pricing_payment_schedule_price_color || accent;

  const brandFont = fontFamily(branding.title_font_family || branding.font_heading, 'system-ui, sans-serif');
  const brandWeight = Number(branding.title_font_weight || branding.font_heading_weight || '700');
  const bodyFont = fontFamily(branding.font_body, 'system-ui, sans-serif');

  const itemTax = (amount: number) =>
    pricing.tax_enabled ? Math.round(amount * (pricing.tax_rate / 100) * 100) / 100 : 0;

  const ps = pricing.payment_schedule
    ? normalizePaymentSchedule(pricing.payment_schedule)
    : null;
  const hasPaymentSchedule = ps && (ps.one_off?.enabled || ps.milestones?.enabled || ps.recurring?.enabled);

  const isLandscape = orientation === 'landscape';

  return (
    <div
      className={`w-full min-h-full flex items-center justify-center ${!isLandscape ? 'py-8 lg:py-12 px-4 sm:px-6' : ''}`}
      style={{
        backgroundColor: branding.bg_image_url ? 'transparent' : bgPrimary,
        ...(isLandscape && { paddingTop: 'clamp(32px, 8vh, 128px)', paddingBottom: 'clamp(24px, 5vh, 64px)', paddingLeft: 'clamp(20px, 10vw, 168px)', paddingRight: 'clamp(20px, 10vw, 168px)' }),
      }}
    >
      {/* Mobile font standardisation — title 22px, body 16px below lg breakpoint */}
      <style>{`
        @media (max-width: 1023px) {
          .agv-pricing-title { font-size: 20px !important; }
          .agv-pricing-body  { font-size: 14px !important; }
        }
      `}</style>

      <div
        className="w-full max-w-[900px] overflow-hidden"
        style={{ backgroundColor: bgSecondary, border: `1px solid ${border}` }}
      >
        {/* Header accent bar */}
        <div className="h-1" style={{ backgroundColor: accent }} />

        <div className="p-6 sm:p-8 lg:p-10" style={{ fontFamily: bodyFont }}>
          {/* Title */}
          <div className="mb-6">
            <h1
              className="agv-pricing-title text-2xl sm:text-3xl font-bold tracking-tight"
              style={{
                color: pricingHeaderTextColor,
                fontFamily: fontFamily(branding.title_font_family || branding.font_heading, 'system-ui, sans-serif'),
                fontWeight: Number(branding.title_font_weight || branding.font_heading_weight || '700'),
                ...(branding.title_font_size ? { fontSize: `${branding.title_font_size}px` } : {}),
              }}
            >
              {pricing.title}
            </h1>
            {clientName && (
              <p className="agv-pricing-body text-sm mt-1.5" style={{ color: pricingTextColor }}>
                Prepared for {clientName}
              </p>
            )}
          </div>

          {/* Intro text */}
          {pricing.intro_text && (
            <p className="agv-pricing-body text-sm leading-relaxed mb-8" style={{ color: pricingTextColor }}>
              {pricing.intro_text}
            </p>
          )}

          {/* Line items table */}
          {(pricing.items ?? []).length > 0 && (
            <div className="mb-6">
              {/* Table header */}
              <div
                className="flex items-center gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg"
                style={{ backgroundColor: surface, color: faint }}
              >
                {(pricing.show_stage ?? true) && (
                  <span className="flex-1">{pricing.stage_label || 'Stage'}</span>
                )}
                {(pricing.show_description ?? true) && (
                  <span className="flex-1">{pricing.description_label || 'Description'}</span>
                )}
                {pricing.qty_enabled && (pricing.show_rate ?? true) && (
                  <>
                    <span className="w-16 text-right shrink-0">{pricing.qty_label || 'Qty'}</span>
                    <span className="w-24 text-right shrink-0">{pricing.rate_label || 'Rate'}</span>
                  </>
                )}
                {!pricing.qty_enabled && (pricing.show_rate ?? true) && (
                  <span className="w-24 text-right shrink-0">{pricing.rate_label || 'Amount'}</span>
                )}
                {pricing.tax_enabled && (
                  <span className="w-24 text-right shrink-0">{pricing.tax_label.split('(')[0].trim()}</span>
                )}
                {(pricing.show_line_total ?? true) && (
                  <span className="w-28 text-right shrink-0">
                    {pricing.total_label || (pricing.tax_enabled ? 'Inc. Tax' : 'Total')}
                  </span>
                )}
              </div>

              {/* Rows */}
              {(pricing.items ?? [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item, idx) => {
                  const effective = effectiveItemAmount(item);
                  const hasDiscount = (item.discount_pct ?? 0) > 0;
                  const gst = itemTax(effective);
                  const unitPrice = item.unit_price ?? item.amount;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 px-4 py-3.5"
                      style={{
                        borderBottom: `1px solid ${border}`,
                        backgroundColor: idx % 2 === 1 ? `${surface}80` : 'transparent',
                      }}
                    >
                      {(pricing.show_stage ?? true) && (
                        <div className="flex-1 min-w-0">
                          {item.description && (
                            <span className="agv-pricing-body text-sm font-medium" style={{ color: pricingPriceTitleColor }}>
                              {item.description}
                            </span>
                          )}
                          {hasDiscount && (
                            <span
                              className="mt-1 block text-[11px] font-semibold px-1.5 py-0.5 rounded w-fit"
                              style={{ backgroundColor: `${accent}20`, color: accent }}
                            >
                              {item.discount_pct}% off
                            </span>
                          )}
                        </div>
                      )}
                      {(pricing.show_description ?? true) && (
                        <div className="flex-1 min-w-0">
                          {item.label && (
                            <span className="agv-pricing-body text-sm" style={{ color: pricingTextColor }}>
                              {item.label}
                            </span>
                          )}
                        </div>
                      )}
                      {pricing.qty_enabled && (pricing.show_rate ?? true) && (
                        <>
                          <span className="agv-pricing-body w-16 text-right shrink-0 text-sm" style={{ color: pricingPriceColor }}>
                            {item.qty ?? 1}
                          </span>
                          <span className="agv-pricing-body w-24 text-right shrink-0 text-sm" style={{ color: pricingPriceColor }}>
                            {hasDiscount ? (
                              <span className="line-through opacity-50">{formatAUD(unitPrice)}</span>
                            ) : formatAUD(unitPrice)}
                          </span>
                        </>
                      )}
                      {!pricing.qty_enabled && (pricing.show_rate ?? true) && (
                        <span className="agv-pricing-body w-24 text-right shrink-0 text-sm" style={{ color: pricingPriceColor }}>
                          {hasDiscount ? (
                            <span className="line-through opacity-50">{formatAUD(item.amount)}</span>
                          ) : formatAUD(item.amount)}
                        </span>
                      )}
                      {pricing.tax_enabled && (
                        <span className="agv-pricing-body w-24 text-right shrink-0 text-sm" style={{ color: pricingPriceColor }}>
                          {formatAUD(gst)}
                        </span>
                      )}
                      {(pricing.show_line_total ?? true) && (
                        <span className="agv-pricing-body w-28 text-right shrink-0 text-sm font-medium" style={{ color: pricingPriceColor }}>
                          {formatAUD(pricing.tax_enabled ? effective + gst : effective)}
                        </span>
                      )}
                    </div>
                  );
                })}

              {/* Subtotal / Discount / Tax / Total — each independently toggleable */}
              {((pricing.show_subtotal ?? true) || (pricing.show_discount ?? true) || (pricing.show_total ?? true) || pricing.tax_enabled) && (
                <div className="rounded-b-lg overflow-hidden" style={{ backgroundColor: surface }}>
                  {/* Subtotal (with discount strikethrough if applicable) */}
                  {(pricing.show_subtotal ?? true) && totalDiscount > 0 && (pricing.show_discount ?? true) && (
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                      <span className="agv-pricing-body text-sm" style={{ color: pricingTextColor }}>Subtotal</span>
                      <span className="agv-pricing-body text-sm font-semibold" style={{ color: pricingTextColor, textDecoration: 'line-through' }}>{formatAUD(baseSubtotal)}</span>
                    </div>
                  )}
                  {(pricing.show_subtotal ?? true) && (totalDiscount === 0 || !(pricing.show_discount ?? true)) && (
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                      <span className="agv-pricing-body text-sm" style={{ color: pricingTextColor }}>Subtotal</span>
                      <span className="agv-pricing-body text-sm font-semibold" style={{ color: pricingPriceColor }}>{formatAUD(subtotal)}</span>
                    </div>
                  )}
                  {/* Discount rows */}
                  {(pricing.show_discount ?? true) && totalDiscount > 0 && (
                    <>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                        <span className="agv-pricing-body text-sm font-medium" style={{ color: accent }}>Discount savings</span>
                        <span className="agv-pricing-body text-sm font-semibold" style={{ color: accent }}>−{formatAUD(totalDiscount)}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                        <span className="agv-pricing-body text-sm" style={{ color: pricingTextColor }}>After discount</span>
                        <span className="agv-pricing-body text-sm font-semibold" style={{ color: pricingPriceColor }}>{formatAUD(subtotal)}</span>
                      </div>
                    </>
                  )}
                  {/* Tax row */}
                  {pricing.tax_enabled && (
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
                      <span className="agv-pricing-body text-sm" style={{ color: pricingTextColor }}>{pricing.tax_label}</span>
                      <span className="agv-pricing-body text-sm font-semibold" style={{ color: pricingPriceColor }}>{formatAUD(tax)}</span>
                    </div>
                  )}
                  {/* Grand total */}
                  {(pricing.show_total ?? true) && (
                    <div className="flex items-center justify-between px-4 py-4">
                      <span className="agv-pricing-body text-base font-bold" style={{ color: pricingPriceTitleColor }}>
                        {pricing.total_label || (pricing.tax_enabled ? 'Total (inc. tax)' : 'Total')}
                      </span>
                      <span className="agv-pricing-body text-xl font-bold" style={{ color: pricingPriceColor }}>{formatAUD(total)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer note */}
          {pricing.footer_note && (
            <p className="agv-pricing-body text-xs leading-relaxed mb-6 italic" style={{ color: pricingTextColor }}>
              {pricing.footer_note}
            </p>
          )}

          {/* ─── Payment Schedule ──────────────────────────────────── */}
          {hasPaymentSchedule && ps && (
            <div className="mb-8">
              <h3
                className="text-sm mb-3 uppercase tracking-wider"
                style={{
                  color: faint,
                  fontFamily: brandFont,
                  fontWeight: brandWeight,
                }}
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
                        <span className="agv-pricing-body text-sm" style={{ color: pricingPaymentScheduleNameColor, fontFamily: brandFont, fontWeight: brandWeight }}>
                          {ps.one_off.label}
                        </span>
                        {ps.one_off.note && (
                          <p className="text-xs mt-0.5" style={{ color: pricingTextColor }}>
                            {ps.one_off.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="agv-pricing-body text-sm shrink-0 ml-4" style={{ color: pricingPaymentSchedulePriceColor, fontFamily: brandFont, fontWeight: brandWeight }}>
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
                              <span className="agv-pricing-body text-sm" style={{ color: pricingPaymentScheduleNameColor, fontFamily: brandFont, fontWeight: brandWeight }}>
                                {payment.label}
                              </span>
                              {payment.note && (
                                <p className="text-xs mt-0.5" style={{ color: pricingTextColor }}>
                                  {payment.note}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className="agv-pricing-body text-sm shrink-0 ml-4"
                            style={{ color: pricingPaymentSchedulePriceColor, fontFamily: brandFont, fontWeight: brandWeight }}
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
                          <span className="text-2xs" style={{ color: faint, fontFamily: brandFont }}>
                            {ps.milestones.payments[0]?.label} — {formatAUD(milestoneAmount(ps.milestones.payments[0], total))}
                          </span>
                          {ps.milestones.payments.length > 1 && (
                            <span className="text-2xs" style={{ color: faint, fontFamily: brandFont }}>
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
                        <span className="agv-pricing-body text-sm" style={{ color: pricingPaymentScheduleNameColor, fontFamily: brandFont, fontWeight: brandWeight }}>
                          {ps.recurring.label}
                        </span>
                        {ps.recurring.note && (
                          <p className="text-xs mt-0.5" style={{ color: pricingTextColor }}>
                            {ps.recurring.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="agv-pricing-body text-sm shrink-0 ml-4" style={{ color: pricingPaymentSchedulePriceColor, fontFamily: brandFont, fontWeight: brandWeight }}>
                      {formatAUD(ps.recurring.amount)}/{FREQ_LABELS[ps.recurring.frequency] || ps.recurring.frequency}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optional extras */}
          {(pricing.optional_items ?? []).length > 0 && (
            <div className="mb-8">
              <h3
                className="text-sm mb-3 uppercase tracking-wider"
                style={{
                  color: faint,
                  fontFamily: brandFont,
                  fontWeight: brandWeight,
                }}
              >
                Optional Extras
              </h3>
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${border}` }}>
                {(pricing.optional_items ?? [])
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item, idx) => {
                    const effectiveOpt = effectiveItemAmount(item);
                    const hasOptDiscount = (item.discount_pct ?? 0) > 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-4 py-3"
                        style={{
                          borderBottom: idx < (pricing.optional_items ?? []).length - 1 ? `1px solid ${border}` : undefined,
                          backgroundColor: idx % 2 === 0 ? 'transparent' : `${surface}80`,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="agv-pricing-body text-sm font-medium" style={{ color: textColor }}>{item.label}</span>
                          {item.description && (
                            <span className="text-xs ml-2" style={{ color: muted }}>{item.description}</span>
                          )}
                          {hasOptDiscount && (
                            <span
                              className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${accent}20`, color: accent }}
                            >
                              {item.discount_pct}% off
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          {hasOptDiscount && (
                            <span className="agv-pricing-body text-xs block line-through" style={{ color: muted }}>
                              {formatAUD(item.amount)}
                            </span>
                          )}
                          <span className="agv-pricing-body text-sm font-medium" style={{ color: textColor }}>
                            {formatAUD(effectiveOpt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Quote validity */}
          {pricing.validity_days && pricing.proposal_date && (() => {
            const expired = isQuoteExpired(pricing.proposal_date, pricing.validity_days);

            return (
              <div className="space-y-2">
                <div
                  className="rounded-lg px-4 py-3 text-xs flex items-center justify-between"
                  style={{
                    backgroundColor: expired ? `${accent}15` : surface,
                    border: expired ? `1px solid ${accent}40` : 'none',
                    color: muted,
                  }}
                >
                  <span>
                    Quote valid for {pricing.validity_days} days from {formatDate(pricing.proposal_date)}
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: expired ? accent : textColor }}
                  >
                    {expired ? 'Expired' : 'Expires'} {getExpiryDate(pricing.proposal_date, pricing.validity_days)}
                  </span>
                </div>

                {expired && (
                  <div
                    className="rounded-lg px-4 py-3 text-xs"
                    style={{
                      backgroundColor: `${accent}10`,
                      border: `1px solid ${accent}30`,
                      color: textColor,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: accent }}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                      </svg>
                      <div>
                        <p className="font-medium" style={{ color: accent }}>
                          This quote has passed its valid date
                        </p>
                        <p className="mt-1 leading-relaxed" style={{ color: muted }}>
                          The pricing in this proposal may no longer be current. Please reach out
                          to{' '}
                          <span className="font-medium" style={{ color: textColor }}>
                            {branding.name || 'the team'}
                          </span>{' '}
                          to confirm if this quote is still valid.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}