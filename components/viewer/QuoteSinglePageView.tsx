// components/viewer/QuoteSinglePageView.tsx
// Single-page quote viewer. Editorial layout — every visible element pulls
// its colour and font from the same three-tier cascade (per-quote → company
// branding → fallback) so the Design tab actually drives the whole document
// and not just headlines.

'use client';

import type { Proposal, ProposalPricing } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { formatQuoteNumber } from '@/lib/quote-number';
import ProposalDecisionPanel from '@/components/viewer/ProposalDecisionPanel';
import { Clock, AlertTriangle } from 'lucide-react';

import { TABULAR, withAlpha } from './quote-view/quote-view-helpers';
import { Section, SectionLabel, Hairline, AttachmentLink } from './quote-view/QuoteViewPrimitives';
import { useQuoteTokens } from './quote-view/useQuoteTokens';

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
  const {
    palette,
    decisionExtras,
    extras,
    fmt,
    items,
    optionalItems,
    subtotal,
    gstEnabled,
    gstRatePct,
    taxAmount,
    total,
    deposit,
    milestones,
    validUntil,
    expiryState,
    quoteDate,
    scopeOfWorks,
    attachments,
    headerBg,
    headerText,
    headerSubtle,
    displayCompanyName,
    bodyBg,
    bodyText,
    headingColor,
    muted,
    faint,
    hairline,
    headingFontFamily,
    titleFontFamily,
    titleFontWeight,
    articleStyle,
    labelStyle,
    titleStyle,
    mutedStyle,
    heroUrl,
    featureUrl,
  } = useQuoteTokens({
    proposal,
    pricing,
    branding,
    resolvedBgUrl,
    companyName,
    quoteNumberFormat,
  });

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
            {(quoteDate || validUntil) && (
              <div
                className="text-2xs tracking-[0.18em] uppercase mt-2 opacity-60 space-y-0.5"
                style={{ color: headerSubtle, fontFamily: headingFontFamily }}
              >
                {quoteDate && <div>Issued {quoteDate}</div>}
                {validUntil && <div>Valid until {validUntil}</div>}
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
            backgroundColor: palette.accentSurface,
            border: `1px solid ${palette.borderSubtle}`,
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
            <table className="w-full min-w-0 sm:min-w-[480px]" style={TABULAR}>
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
                {items.map((it) => {
                  const hasDiscount = (it.discount_pct ?? 0) > 0;
                  const effectiveAmount = hasDiscount
                    ? Math.round(it.amount * (1 - (it.discount_pct! / 100)) * 100) / 100
                    : it.amount;
                  return (
                    <tr
                      key={it.id}
                      className="align-top last:[&_td]:border-0"
                      style={{ borderBottom: `1px solid ${palette.borderSubtle}` }}
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
                        {hasDiscount ? (
                          <div>
                            <div>{fmt(effectiveAmount)}</div>
                            <div className="text-xs line-through mt-0.5" style={{ color: faint }}>
                              {fmt(it.amount)}
                            </div>
                          </div>
                        ) : (
                          fmt(it.amount)
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                const hasDiscount = (it.discount_pct ?? 0) > 0;
                const eff =
                  (it.amount ?? 0) * (1 - ((it.discount_pct ?? 0) / 100));
                return (
                  <div
                    key={it.id}
                    className="flex items-start justify-between gap-4 py-3"
                    style={{ borderBottom: `1px solid ${palette.borderSubtle}` }}
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
                    <div className="text-[15px] shrink-0 text-right" style={{ color: bodyText, ...TABULAR }}>
                      {hasDiscount ? (
                        <>
                          <div>{fmt(eff)}</div>
                          <div className="text-xs line-through mt-0.5" style={{ color: faint }}>
                            {fmt(it.amount)}
                          </div>
                        </>
                      ) : (
                        fmt(eff)
                      )}
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
      <Section>
        <SectionLabel style={labelStyle}>Investment</SectionLabel>
        <div
          className="rounded-2xl px-6 py-7 sm:px-8 sm:py-8"
          style={{
            background: headerBg,
            color: headerText,
            boxShadow: `inset 0 0 0 1px ${withAlpha(headerText, 0.08)}`,
          }}
        >
          {/* ── Summary rows ─────────────────────────────────── */}
          <div className="space-y-2 text-sm tabular-nums mb-5" style={{ color: withAlpha(headerText, 0.7) }}>
            {gstEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>GST ({gstRatePct}%)</span>
                  <span>{fmt(taxAmount)}</span>
                </div>
              </>
            )}
          </div>

          {/* ── Total ────────────────────────────────────────── */}
          {gstEnabled && (
            <div className="mb-5" style={{ borderTop: `1px solid ${withAlpha(headerText, 0.12)}`, paddingTop: '1.25rem' }} />
          )}
          <div>
            <div
              style={{
                ...labelStyle,
                color: withAlpha(headerText, 0.55),
                marginBottom: '0.5rem',
              }}
            >
              Total{gstEnabled ? ' (incl. GST)' : ''}
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
          </div>

          {/* ── Payment schedule / Deposit ────────────────────── */}
          {(deposit || milestones.length > 0) && (
            <div
              className="mt-6 pt-5 space-y-3"
              style={{ borderTop: `1px solid ${withAlpha(headerText, 0.12)}` }}
            >
              <div
                style={{
                  ...labelStyle,
                  color: withAlpha(headerText, 0.55),
                  marginBottom: '0.5rem',
                }}
              >
                Payment Schedule
              </div>

              {milestones.length > 0 ? (
                milestones.map((ms, i) => {
                  const msAmount = ms.type === 'percentage'
                    ? Math.round(total * (ms.value / 100) * 100) / 100
                    : ms.value;
                  return (
                    <div
                      key={ms.id || i}
                      className="flex items-center justify-between text-sm"
                      style={{ color: withAlpha(headerText, 0.8) }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 tabular-nums text-xs" style={{ color: withAlpha(headerText, 0.5) }}>
                          {i + 1}
                        </span>
                        <span className="truncate">{ms.label || `Payment ${i + 1}`}</span>
                        {ms.type === 'percentage' && (
                          <span className="shrink-0 text-xs tabular-nums" style={{ color: withAlpha(headerText, 0.5) }}>
                            {ms.value}%
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-medium tabular-nums" style={{ color: headerText }}>
                        {fmt(msAmount)}
                      </span>
                    </div>
                  );
                })
              ) : deposit ? (
                <div className="flex items-center justify-between text-sm" style={{ color: withAlpha(headerText, 0.8) }}>
                  <div className="flex items-center gap-2">
                    <span>{deposit.label}</span>
                    <span className="text-xs tabular-nums" style={{ color: withAlpha(headerText, 0.5) }}>
                      {deposit.pct}%
                    </span>
                  </div>
                  <span className="font-medium tabular-nums" style={{ color: headerText }}>
                    {fmt(deposit.amount)}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* ── Valid until ───────────────────────────────────── */}
          {validUntil && (
            <div
              className="mt-5 pt-4 text-xs"
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
            proposalTitle={proposal.title || undefined}
            totalAmount={total > 0 ? fmt(total) : undefined}
            isExpired={expiryState.kind === 'expired'}
            companyName={displayCompanyName}
            companyEmail={companyEmail ?? undefined}
            companyPhone={companyPhone ?? undefined}
            acceptHeading={decisionExtras.accept_heading}
            acceptSubtitle={decisionExtras.accept_subtitle}
            agreementText={decisionExtras.agreement_text}
            acceptButtonLabel={decisionExtras.accept_button_label}
            declineHeading={decisionExtras.decline_heading}
            declineSubtitle={decisionExtras.decline_subtitle}
            declineButtonLabel={decisionExtras.decline_button_label}
            revisionHeading={decisionExtras.revision_heading}
            revisionSubtitle={decisionExtras.revision_subtitle}
            revisionButtonLabel={decisionExtras.revision_button_label}
            acceptButtonColor={
              (proposal as unknown as Record<string, string | null | undefined>)?.decision_action_accent_color ||
              branding.decision_action_accent_color
            }
            declineButtonColor={
              (proposal as unknown as Record<string, string | null | undefined>)?.decision_decline_button_color ||
              branding.decision_decline_button_color
            }
            revisionButtonColor={
              (proposal as unknown as Record<string, string | null | undefined>)?.decision_revision_button_color ||
              branding.decision_revision_button_color
            }
            checkboxColor={
              (proposal as unknown as Record<string, string | null | undefined>)?.decision_checkbox_color ||
              branding.decision_checkbox_color
            }
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
        className="px-8 sm:px-14 py-6 text-detail tracking-[0.12em] uppercase"
        style={{
          color: muted,
          fontFamily: headingFontFamily,
          borderTop: `1px solid ${hairline}`,
        }}
      >
        <div className="flex items-center justify-between gap-x-6 gap-y-1 flex-wrap">
          <span>{displayCompanyName}</span>
          <span className="flex items-center gap-x-4 gap-y-1 flex-wrap">
            {companyPhone && <span>{companyPhone}</span>}
            {companyEmail && <span>{companyEmail}</span>}
          </span>
        </div>
        {(companyAbn || formatQuoteNumber(proposal.quote_number, quoteNumberFormat)) && (
          <div className="flex items-center gap-4 mt-2 opacity-60" style={TABULAR}>
            {companyAbn && <span>ABN {companyAbn}</span>}
            {formatQuoteNumber(proposal.quote_number, quoteNumberFormat) && (
              <span>{formatQuoteNumber(proposal.quote_number, quoteNumberFormat)}</span>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}
