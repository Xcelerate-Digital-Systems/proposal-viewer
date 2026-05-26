// components/admin/builder-sections/DecisionPagePreview.tsx
// Sticky preview for the Decision tab. Renders the Next Steps + Terms +
// accept/decline form using the same tokens the live viewer applies, so the
// user sees exactly what the client will see while editing.

'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import ViewerPagePreview from '@/components/admin/shared/ViewerPagePreview';
import ProposalDecisionPanel from '@/components/viewer/ProposalDecisionPanel';
import { DEFAULT_DECISION_NEXT_STEPS } from '@/lib/types/decision-extras';

interface DecisionPagePreviewProps {
  entityId: string;
  entityKey: 'proposal_id' | 'template_id';
  /** Live title from the DecisionPageCard's input. */
  title: string | null;
  /** Live Next Steps list from the tab. */
  steps: string[];
  /** Live Terms copy from the tab. */
  terms: string;
  /** Live Accept-form copy. */
  acceptHeading: string;
  acceptSubtitle: string;
  agreementText: string;
  acceptButtonLabel: string;
  declineButtonLabel: string;
  revisionButtonLabel: string;
}

/* ── Helper duplicated from DesignPreviews to keep the preview self-contained
     (single fetch path, no cross-file dependency on a non-exported helper).  */
async function loadBranding(
  entityId: string,
  entityKey: 'proposal_id' | 'template_id',
): Promise<CompanyBranding> {
  const table = entityKey === 'template_id' ? 'proposal_templates' : 'proposals';
  const { data: ent } = await supabase
    .from(table)
    .select(
      'company_id, text_page_bg_color, text_page_text_color, text_page_heading_color, title_font_family, title_font_weight, decision_action_bg_color, decision_action_text_color, decision_action_heading_color, decision_action_accent_color',
    )
    .eq('id', entityId)
    .single();
  const cid = (ent?.company_id as string | undefined) ?? null;
  let merged: CompanyBranding = { ...DEFAULT_BRANDING };
  if (cid) {
    const r = await fetch(`/api/company/branding?company_id=${cid}`);
    if (r.ok) merged = { ...merged, ...(await r.json()) };
  }
  if (ent) {
    if (ent.text_page_bg_color) merged.text_page_bg_color = ent.text_page_bg_color;
    if (ent.text_page_text_color) merged.text_page_text_color = ent.text_page_text_color;
    if (ent.text_page_heading_color) merged.text_page_heading_color = ent.text_page_heading_color;
    if (ent.title_font_family) merged.title_font_family = ent.title_font_family;
    if (ent.title_font_weight) merged.title_font_weight = ent.title_font_weight;
    if (ent.decision_action_bg_color) merged.decision_action_bg_color = ent.decision_action_bg_color;
    if (ent.decision_action_text_color) merged.decision_action_text_color = ent.decision_action_text_color;
    if (ent.decision_action_heading_color) merged.decision_action_heading_color = ent.decision_action_heading_color;
    if (ent.decision_action_accent_color) merged.decision_action_accent_color = ent.decision_action_accent_color;
  }
  return merged;
}

/* ── withAlpha — duplicated from ProposalDecisionPanel for the same reason. */
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

export default function DecisionPagePreview({
  entityId,
  entityKey,
  title,
  steps,
  terms,
  acceptHeading,
  acceptSubtitle,
  agreementText,
  acceptButtonLabel,
  declineButtonLabel,
  revisionButtonLabel,
}: DecisionPagePreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await loadBranding(entityId, entityKey);
      if (!cancelled) {
        setBranding(b);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // Same cascade as ViewerPageContent's buildDecisionTokens.
  const bodyBg =
    branding.decision_action_bg_color ||
    branding.text_page_bg_color ||
    '#ffffff';
  const bodyText =
    branding.decision_action_text_color ||
    branding.text_page_text_color ||
    '#1E2432';
  const headingColor =
    branding.decision_action_heading_color ||
    branding.text_page_heading_color ||
    bodyText;
  const muted = withAlpha(bodyText, 0.6);
  const faint = withAlpha(bodyText, 0.45);
  const hairline = withAlpha(bodyText, 0.1);
  const headingFontFamily = fontStack(branding.font_heading, 'inherit');
  const bodyFontFamily = fontStack(branding.font_body, 'inherit');
  const bodyFontWeight = branding.font_body_weight ? Number(branding.font_body_weight) || undefined : undefined;
  const titleFontFamily = fontStack(
    branding.title_font_family || branding.font_heading,
    'inherit',
  );
  const titleFontWeight = branding.title_font_weight || '600';
  const titleStyle: React.CSSProperties = {
    fontFamily: titleFontFamily,
    fontWeight: Number(titleFontWeight) || 600,
    color: headingColor,
  };

  const cleanedSteps = steps
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  const fallbackSteps = cleanedSteps.length > 0 ? cleanedSteps : DEFAULT_DECISION_NEXT_STEPS;
  const hasTerms = terms.trim().length > 0;
  // The live viewer doesn't render a page title on the Decision page — the
  // title only drives the sidebar TOC entry — so we ignore it here too.
  void title;

  // No-op handlers — the panel just needs at least one defined to render the
  // pending-state form. We never submit from the preview.
  const noopAccept = async (_name: string) => { void _name; };
  const noopDecline = async (_name: string, _reason: string) => { void _name; void _reason; };
  const noopRevision = async (_name: string, _notes: string) => { void _name; void _notes; };

  return (
    <ViewerPagePreview branding={branding}>
      {/* Match ViewerPageContent's onDecisionPage layout: centred card on the
          page-around background (ViewerPagePreview already paints bg_primary
          + bg-image underlay) with Next Steps, Terms, divider, and the real
          ProposalDecisionPanel rendering the live form. */}
      <div className="relative w-full min-h-[100vh] flex items-start justify-center px-6 sm:px-14 py-12">
        <div
          className="w-full max-w-2xl rounded-2xl shadow-popover px-6 sm:px-12 py-10"
          style={{
            backgroundColor: bodyBg,
            color: bodyText,
            fontFamily: bodyFontFamily,
            fontWeight: bodyFontWeight,
          }}
        >
          {fallbackSteps.length > 0 && (
            <section className="mb-8">
              <p
                className="text-2xs tracking-[0.18em] uppercase mb-4"
                style={{ color: faint, fontFamily: headingFontFamily }}
              >
                Next Steps
              </p>
              <ol className="space-y-3">
                {fallbackSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-[1.55]">
                    <span
                      className="shrink-0 tabular-nums text-xs font-medium mt-0.5"
                      style={{ color: muted }}
                    >
                      0{i + 1}
                    </span>
                    <span style={{ color: bodyText }}>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {hasTerms && (
            <section className="mb-8">
              <p
                className="text-2xs tracking-[0.18em] uppercase mb-3"
                style={{ color: faint, fontFamily: headingFontFamily }}
              >
                Terms
              </p>
              <p
                className="text-xs whitespace-pre-wrap leading-[1.7]"
                style={{ color: muted }}
              >
                {terms}
              </p>
            </section>
          )}

          {(fallbackSteps.length > 0 || hasTerms) && (
            <div className="mx-auto mb-8 h-px max-w-md" style={{ backgroundColor: hairline }} />
          )}

          <ProposalDecisionPanel
            onAccept={noopAccept}
            onDecline={noopDecline}
            onRequestRevision={noopRevision}
            tokens={{
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
            }}
            acceptHeading={acceptHeading}
            acceptSubtitle={acceptSubtitle}
            agreementText={agreementText}
            acceptButtonLabel={acceptButtonLabel}
            declineButtonLabel={declineButtonLabel}
            revisionButtonLabel={revisionButtonLabel}
            buttonFontFamily={branding.font_button || branding.font_heading}
            buttonFontWeight={branding.font_button_weight || branding.font_heading_weight}
          />
        </div>
      </div>
    </ViewerPagePreview>
  );
}
