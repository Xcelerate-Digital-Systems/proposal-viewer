// components/viewer/ViewerPageContent.tsx
'use client';

import { RefObject } from 'react';
import type { CompanyBranding, PageUrlEntry } from '@/hooks/useProposal';
import type { ProposalPricing, ProposalPackages, TocSettings, PageNameEntry } from '@/lib/supabase';
import dynamic from 'next/dynamic';
const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false });
import TextPage from './TextPage';
import TocPage, { type PageSequenceEntry } from './TocPage';
import PricingPage from './PricingPage';
import PackagesPage from './PackagesPage';
import ViewerBackground from './ViewerBackground';
import ProposalDecisionPanel, { type DecisionPanelTokens } from './ProposalDecisionPanel';
import { parseDecisionExtras } from '@/lib/types/decision-extras';

interface ViewerPageContentProps {
  branding: CompanyBranding;
  bgPrimary: string;
  pageOrientation: 'portrait' | 'landscape';
  scrollRef: RefObject<HTMLDivElement>;
  // Page type flags
  onTocPage: boolean;
  onTextPage: boolean;
  onPricingPage: boolean;
  onPackagesPage: boolean;
  onDecisionPage: boolean;
  // Page data
  tocSettings: TocSettings | null;
  pageSequence: PageSequenceEntry[];
  pageEntries: PageNameEntry[];
  numPages: number;
  currentTextPage: Record<string, unknown> | undefined;
  pricing: unknown;
  currentPackages: unknown;
  // PDF
  pdfUrl: string | null;
  pdfPage: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  accentColor: string;
  pageUrls: PageUrlEntry[];
  // Context
  proposal: Record<string, unknown> | null;
  clientLogoUrl: string | undefined;
  // Decision page actions + initial state
  accepted?: boolean;
  declined?: boolean;
  revisionRequested?: boolean;
  onAccept?: (name: string) => Promise<void>;
  onDecline?: (name: string, reason: string) => Promise<void>;
  onRequestRevision?: (name: string, notes: string) => Promise<void>;
}

/** Convert a CSS colour to rgba with explicit alpha. */
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
  return color;
}

function fontStack(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  return `'${name}', ${fallback}`;
}

/** Resolve the Decision panel style tokens via the cascade:
    proposal.decision_action_* → branding.decision_action_* → text_page_* → defaults. */
function buildDecisionTokens(
  proposal: Record<string, unknown> | null,
  branding: CompanyBranding,
): DecisionPanelTokens {
  const p = (proposal ?? {}) as Record<string, string | null | undefined>;
  const bodyBg =
    p.decision_action_bg_color ||
    branding.decision_action_bg_color ||
    p.text_page_bg_color ||
    branding.text_page_bg_color ||
    '#ffffff';
  const bodyText =
    p.decision_action_text_color ||
    branding.decision_action_text_color ||
    p.text_page_text_color ||
    branding.text_page_text_color ||
    '#1E2432';
  const headingColor =
    p.decision_action_heading_color ||
    branding.decision_action_heading_color ||
    p.text_page_heading_color ||
    branding.text_page_heading_color ||
    bodyText;
  // Accent currently overrides the submit-button bg via headingColor — we keep
  // the existing behaviour here (caller can swap for a dedicated accent token
  // later if needed without changing the panel).
  const muted = withAlpha(bodyText, 0.6);
  const faint = withAlpha(bodyText, 0.45);
  const hairline = withAlpha(bodyText, 0.1);
  const headingFontFamily = fontStack(branding.font_heading, 'inherit');
  const bodyFontFamily = fontStack(branding.font_body, 'inherit');
  const bodyFontWeight = branding.font_body_weight ? Number(branding.font_body_weight) || undefined : undefined;
  const titleFontFamily = fontStack(
    p.title_font_family || branding.title_font_family || branding.font_heading,
    'inherit',
  );
  const titleFontWeight = p.title_font_weight || branding.title_font_weight || '600';
  const titleStyle: React.CSSProperties = {
    fontFamily: titleFontFamily,
    fontWeight: Number(titleFontWeight) || 600,
    color: headingColor,
  };
  return {
    bodyBg,
    bodyText,
    headingColor,
    muted,
    faint,
    hairline,
    headingFontFamily,
    bodyFontFamily,
    bodyFontWeight,
    titleStyle,
    mutedStyle: { color: muted },
  };
}

export default function ViewerPageContent({
  branding, bgPrimary, pageOrientation, scrollRef,
  onTocPage, onTextPage, onPricingPage, onPackagesPage, onDecisionPage,
  tocSettings, pageSequence, pageEntries, numPages,
  currentTextPage, pricing, currentPackages,
  pdfUrl, pdfPage, onLoadSuccess, accentColor, pageUrls,
  proposal, clientLogoUrl,
  accepted, declined, revisionRequested,
  onAccept, onDecline, onRequestRevision,
}: ViewerPageContentProps) {
  if (onDecisionPage) {
    const tokens = buildDecisionTokens(proposal, branding);
    const acceptButtonText =
      (proposal as { accept_button_text?: string | null } | null)?.accept_button_text ?? undefined;
    const extras = parseDecisionExtras(
      (proposal as { decision_extras?: unknown } | null)?.decision_extras,
    );
    const hasSteps = extras.next_steps.length > 0;
    const hasTerms = extras.terms.trim().length > 0;
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full flex items-start justify-center px-6 sm:px-14 py-12">
            <div
              className="w-full max-w-2xl rounded-2xl shadow-[0_10px_40px_-12px_rgba(15,23,42,0.25),0_4px_12px_-4px_rgba(15,23,42,0.08)] px-6 sm:px-12 py-10"
              style={{
                backgroundColor: tokens.bodyBg,
                color: tokens.bodyText,
                // Apply body font on the outer card so Next Steps / Terms /
                // any chrome around the panel inherits the Globals body font
                // — not just the panel itself.
                fontFamily: tokens.bodyFontFamily,
                fontWeight: tokens.bodyFontWeight,
              }}
            >
              {hasSteps && (
                <section className="mb-8">
                  <p
                    className="text-[10px] tracking-[0.18em] uppercase mb-4"
                    style={{ color: tokens.faint, fontFamily: tokens.headingFontFamily }}
                  >
                    Next Steps
                  </p>
                  <ol className="space-y-3">
                    {extras.next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.55]">
                        <span
                          className="shrink-0 tabular-nums text-[12px] font-medium mt-0.5"
                          style={{ color: tokens.muted }}
                        >
                          0{i + 1}
                        </span>
                        <span style={{ color: tokens.bodyText }}>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {hasTerms && (
                <section className="mb-8">
                  <p
                    className="text-[10px] tracking-[0.18em] uppercase mb-3"
                    style={{ color: tokens.faint, fontFamily: tokens.headingFontFamily }}
                  >
                    Terms
                  </p>
                  <p
                    className="text-[12.5px] whitespace-pre-wrap leading-[1.7]"
                    style={{ color: tokens.muted }}
                  >
                    {extras.terms}
                  </p>
                </section>
              )}

              {(hasSteps || hasTerms) && (
                <div
                  className="mx-auto mb-8 h-px max-w-md"
                  style={{ backgroundColor: tokens.hairline }}
                />
              )}

              <ProposalDecisionPanel
                onAccept={onAccept}
                onDecline={onDecline}
                onRequestRevision={onRequestRevision}
                accepted={accepted}
                declined={declined}
                revisionRequested={revisionRequested}
                tokens={tokens}
                acceptButtonText={acceptButtonText}
                acceptHeading={extras.accept_heading}
                acceptSubtitle={extras.accept_subtitle}
                agreementText={extras.agreement_text}
                acceptButtonLabel={extras.accept_button_label}
                declineButtonLabel={extras.decline_button_label}
                revisionButtonLabel={extras.revision_button_label}
                buttonFontFamily={branding.font_button || branding.font_heading}
                buttonFontWeight={branding.font_button_weight || branding.font_heading_weight}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (onTocPage && tocSettings) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full h-full">
            <TocPage
              branding={branding}
              tocSettings={tocSettings}
              pageSequence={pageSequence}
              pageEntries={pageEntries}
              numPages={numPages}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  if (onTextPage && currentTextPage) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full h-full">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TextPage
              textPage={currentTextPage as any}
              branding={branding}
              clientName={proposal?.client_name as string | undefined}
              companyName={branding.name}
              userName={proposal?.created_by_name as string | undefined}
              proposalTitle={proposal?.title as string | undefined}
              clientLogoUrl={clientLogoUrl}
              clientLogoTintColor={(proposal as { cover_client_logo_tint_color?: string | null } | undefined)?.cover_client_logo_tint_color ?? null}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  if (onPricingPage && pricing) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full">
            <PricingPage
              pricing={pricing as unknown as ProposalPricing}
              branding={branding}
              clientName={proposal?.client_name as string | undefined}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  if (onPackagesPage && currentPackages) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full">
            <PackagesPage
              packages={currentPackages as unknown as ProposalPackages}
              branding={branding}
              clientName={proposal?.client_name as string | undefined}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PdfViewer
      pdfUrl={pdfUrl}
      currentPage={pdfPage}
      onLoadSuccess={onLoadSuccess}
      scrollRef={scrollRef}
      bgColor={bgPrimary}
      accentColor={accentColor}
      branding={branding}
      pageUrls={pageUrls.filter((p) => p.type === 'pdf')}
    />
  );
}
