// components/viewer/PricingPage.tsx
'use client';

import {
  ProposalPricing, PricingLineItem, PricingOptionalItem,
  formatAUD, pricingSubtotal, pricingTax,
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

  // Muted text helper
  const muted = `${textColor}99`;
  const faint = `${textColor}55`;

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
                <span className="w-16 shrink-0" />
                <span className="flex-1">Description</span>
                <span className="w-14 text-right shrink-0">%</span>
                <span className="w-28 text-right shrink-0">Amount</span>
              </div>

              {/* Rows */}
              {pricing.items
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 px-4 py-3.5"
                    style={{
                      borderBottom: `1px solid ${border}`,
                      backgroundColor: idx % 2 === 1 ? `${surface}80` : 'transparent',
                    }}
                  >
                    <span className="w-16 shrink-0 text-xs font-medium" style={{ color: accent }}>
                      {item.description || `Stage ${String(idx + 1).padStart(2, '0')}`}
                    </span>
                    <span className="flex-1 text-sm font-medium" style={{ color: textColor }}>
                      {item.label}
                    </span>
                    <span className="w-14 text-right shrink-0 text-xs" style={{ color: muted }}>
                      {subtotal > 0 ? `${Math.round((item.amount / subtotal) * 100)}%` : '—'}
                    </span>
                    <span className="w-28 text-right shrink-0 text-sm font-medium" style={{ color: textColor }}>
                      {formatAUD(item.amount)}
                    </span>
                  </div>
                ))}

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
                  <span className="text-base font-bold" style={{ color: textColor }}>Total</span>
                  <span className="text-xl font-bold" style={{ color: accent }}>{formatAUD(total)}</span>
                </div>
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