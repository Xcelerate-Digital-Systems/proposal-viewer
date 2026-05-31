// components/admin/builder-sections/DesignPreviews.tsx
// Tiny sticky preview components used in the Design tab. Each one loads the
// first relevant page from the entity (pricing / text) and renders the
// existing viewer preview component. Live updates after each design-tab save
// because the parent entity re-fetches and the preview re-mounts.
'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, DollarSign, CheckSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import type { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import ViewerPagePreview from '@/components/admin/shared/ViewerPagePreview';
import ProposalDecisionPanel from '@/components/viewer/ProposalDecisionPanel';
import { DEFAULT_DECISION_NEXT_STEPS } from '@/lib/types/decision-extras';

interface PreviewProps {
  entityId: string;
  entityKey: 'proposal_id' | 'template_id';
}

/** Live design-tab colour overrides that take precedence over whatever was
 *  last saved to the entity row. Without this, the preview only refreshes
 *  after the debounced save lands (or never, if the parent doesn't re-fetch),
 *  so adjustments don't visibly update the preview. */
export interface PricingPreviewLive {
  pricing_header_text_color: string | null;
  pricing_text_color: string | null;
  pricing_price_title_color: string | null;
  pricing_price_color: string | null;
  pricing_payment_schedule_name_color: string | null;
  pricing_payment_schedule_price_color: string | null;
  pricing_accent_bar_color: string | null;
  pricing_dot_color: string | null;
}

/* ── Helper: fetch branding for an entity ───────────────────────── */
async function loadBranding(entityId: string, entityKey: 'proposal_id' | 'template_id'): Promise<CompanyBranding> {
  const table = entityKey === 'template_id' ? 'proposal_templates' : 'proposals';
  const { data: ent } = await supabase
    .from(table)
    .select('company_id, text_page_bg_color, text_page_text_color, text_page_heading_color, title_font_family, title_font_weight, title_font_size, page_num_circle_color, page_num_text_color, bg_image_path, bg_image_overlay_opacity, bg_image_blur')
    .eq('id', entityId)
    .single();
  const cid = (ent?.company_id as string | undefined) ?? null;
  let merged: CompanyBranding = { ...DEFAULT_BRANDING };
  if (cid) {
    const r = await fetch(`/api/company/branding?company_id=${cid}`);
    if (r.ok) merged = { ...merged, ...(await r.json()) };
  }
  // Entity-level overrides
  if (ent) {
    if (ent.text_page_bg_color) merged.text_page_bg_color = ent.text_page_bg_color;
    if (ent.text_page_text_color) merged.text_page_text_color = ent.text_page_text_color;
    if (ent.text_page_heading_color) merged.text_page_heading_color = ent.text_page_heading_color;
    if (ent.title_font_family) merged.title_font_family = ent.title_font_family;
    if (ent.title_font_weight) merged.title_font_weight = ent.title_font_weight;
    if (ent.title_font_size) merged.title_font_size = ent.title_font_size;
    if (ent.bg_image_path) {
      const { data: url } = supabase.storage.from('company-assets').getPublicUrl(ent.bg_image_path);
      if (url?.publicUrl) merged.bg_image_url = url.publicUrl;
      merged.bg_image_overlay_opacity = ent.bg_image_overlay_opacity ?? merged.bg_image_overlay_opacity ?? 0.85;
      merged.bg_image_blur = ent.bg_image_blur ?? 0;
    }
  }
  return merged;
}

/* ============================================================
   Pricing Design Preview
   ============================================================ */

export function PricingDesignPreview({
  entityId,
  entityKey,
  live,
}: PreviewProps & { live?: PricingPreviewLive }) {
  const [loaded, setLoaded] = useState(false);
  const [pricing, setPricing] = useState<Record<string, unknown> | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiBase = entityKey === 'template_id' ? '/api/templates/pages' : '/api/proposals/pages';
      const res = await authFetch(`${apiBase}?${entityKey}=${entityId}`);
      if (res.ok) {
        const pages = await res.json() as Array<{ id: string; type: string; title: string; position: number; payload: Record<string, unknown> }>;
        const first = pages.filter((p) => p.type === 'pricing').sort((a, b) => a.position - b.position)[0];
        if (first && !cancelled) {
          setPricing({
            id: first.id, title: first.title, enabled: true, position: first.position, indent: 0,
            ...first.payload,
          });
        }
      }
      const b = await loadBranding(entityId, entityKey);
      if (!cancelled) {
        setBranding(b);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-edge-strong">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className="rounded-2xl border border-dashed border-edge-strong bg-surface py-16 text-center">
        <DollarSign size={28} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-faint">No pricing page yet</p>
        <p className="text-xs text-gray-300 mt-0.5">Add one on the Quote tab to see a preview here</p>
      </div>
    );
  }

  // Merge live colour edits over the fetched branding so adjusting a picker
  // updates the preview on the next keystroke instead of waiting for save +
  // refetch (which never happens — the parent doesn't re-mount us).
  const mergedBranding: CompanyBranding = {
    ...branding,
    ...(live?.pricing_header_text_color !== undefined
      ? { pricing_header_text_color: live.pricing_header_text_color }
      : {}),
    ...(live?.pricing_text_color !== undefined
      ? { pricing_text_color: live.pricing_text_color }
      : {}),
    ...(live?.pricing_price_title_color !== undefined
      ? { pricing_price_title_color: live.pricing_price_title_color }
      : {}),
    ...(live?.pricing_price_color !== undefined
      ? { pricing_price_color: live.pricing_price_color }
      : {}),
    ...(live?.pricing_payment_schedule_name_color !== undefined
      ? { pricing_payment_schedule_name_color: live.pricing_payment_schedule_name_color }
      : {}),
    ...(live?.pricing_payment_schedule_price_color !== undefined
      ? { pricing_payment_schedule_price_color: live.pricing_payment_schedule_price_color }
      : {}),
    ...(live?.pricing_accent_bar_color !== undefined
      ? { pricing_accent_bar_color: live.pricing_accent_bar_color }
      : {}),
    ...(live?.pricing_dot_color !== undefined
      ? { pricing_dot_color: live.pricing_dot_color }
      : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PricingPreview pricing={pricing as any} branding={mergedBranding} />;
}

/* ============================================================
   Text Page Design Preview
   ============================================================ */

export function TextPageDesignPreview({ entityId, entityKey }: PreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('Text Page');
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiBase = entityKey === 'template_id' ? '/api/templates/pages' : '/api/proposals/pages';
      const res = await authFetch(`${apiBase}?${entityKey}=${entityId}`);
      if (res.ok) {
        const pages = await res.json() as Array<{ type: string; title: string; position: number }>;
        const first = pages.filter((p) => p.type === 'text').sort((a, b) => a.position - b.position)[0];
        if (first && !cancelled) setTitle(first.title || 'Text Page');
      }
      const b = await loadBranding(entityId, entityKey);
      if (!cancelled) {
        setBranding(b);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-edge-strong">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const bg = branding.text_page_bg_color || '#ffffff';
  const text = branding.text_page_text_color || '#1E2432';
  const heading = branding.text_page_heading_color || text;

  return (
    <ViewerPagePreview
      branding={branding}
      label={title}
      icon={<FileText size={11} />}
      footer="Live preview · uses entity styling"
    >
      <div
        style={{ backgroundColor: bg, color: text }}
        className="w-full min-h-[100vh] px-16 py-20"
      >
        <h1
          className="font-semibold mb-6"
          style={{
            color: heading,
            fontFamily: branding.title_font_family || undefined,
            fontWeight: (branding.title_font_weight as unknown as number) || 600,
            fontSize: branding.title_font_size ? `${branding.title_font_size}px` : '36px',
          }}
        >
          {title}
        </h1>
        <p className="text-base leading-relaxed mb-4">
          This is a live preview of your text page styling. The background, body text and heading
          colours all reflect the choices you make to the left.
        </p>
        <p className="text-base leading-relaxed mb-4">
          Page title fonts come from the Globals section above, and the body of pricing and packages
          pages inherits the same colours from here so all your content pages stay visually
          consistent.
        </p>
        <h2
          className="text-2xl font-semibold mt-10 mb-4"
          style={{ color: heading }}
        >
          A second heading
        </h2>
        <p className="text-base leading-relaxed">
          Use the controls on the left to dial in your brand. Changes save automatically and this
          preview refreshes a moment later.
        </p>
      </div>
    </ViewerPagePreview>
  );
}

/* ============================================================
   Decision Design Preview
   ============================================================ */

export interface DecisionPreviewLive {
  decision_bg_color: string | null;
  decision_text_color: string | null;
  decision_heading_color: string | null;
  decision_accept_button_color: string | null;
  decision_decline_button_color: string | null;
  decision_revision_button_color: string | null;
  decision_checkbox_color: string | null;
}

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

export function DecisionDesignPreview({
  entityId,
  entityKey,
  live,
}: PreviewProps & { live?: DecisionPreviewLive }) {
  const [loaded, setLoaded] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [requireSignature, setRequireSignature] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await loadBranding(entityId, entityKey);
      const table = entityKey === 'template_id' ? 'proposal_templates' : 'proposals';
      const { data: row } = await supabase.from(table).select('require_signature').eq('id', entityId).maybeSingle();
      if (!cancelled) {
        setBranding(b);
        setRequireSignature(!!(row as Record<string, unknown> | null)?.require_signature);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-edge-strong">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const bodyBg =
    live?.decision_bg_color ??
    branding.decision_action_bg_color ??
    branding.text_page_bg_color ??
    '#ffffff';
  const bodyText =
    live?.decision_text_color ??
    branding.decision_action_text_color ??
    branding.text_page_text_color ??
    '#1E2432';
  const headingColor =
    live?.decision_heading_color ??
    branding.decision_action_heading_color ??
    branding.text_page_heading_color ??
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

  const noopAccept = async (_name: string) => { void _name; };
  const noopDecline = async (_name: string, _reason: string) => { void _name; void _reason; };
  const noopRevision = async (_name: string, _notes: string) => { void _name; void _notes; };

  return (
    <ViewerPagePreview
      branding={branding}
      label="Decision"
      icon={<CheckSquare size={11} />}
      footer="Live preview · decision page colours"
    >
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
          <section className="mb-8">
            <p
              className="text-2xs tracking-[0.18em] uppercase mb-4"
              style={{ color: faint, fontFamily: headingFontFamily }}
            >
              Next Steps
            </p>
            <ol className="space-y-3">
              {DEFAULT_DECISION_NEXT_STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-[1.55]">
                  <span className="shrink-0 tabular-nums text-xs font-medium mt-0.5" style={{ color: muted }}>
                    0{i + 1}
                  </span>
                  <span style={{ color: bodyText }}>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="mx-auto mb-8 h-px max-w-md" style={{ backgroundColor: hairline }} />

          <ProposalDecisionPanel
            onAccept={noopAccept}
            onDecline={noopDecline}
            onRequestRevision={noopRevision}
            requireSignature={requireSignature}
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
            acceptButtonColor={live?.decision_accept_button_color ?? branding.decision_action_accent_color}
            declineButtonColor={live?.decision_decline_button_color ?? branding.decision_decline_button_color}
            revisionButtonColor={live?.decision_revision_button_color ?? branding.decision_revision_button_color}
            checkboxColor={live?.decision_checkbox_color ?? branding.decision_checkbox_color}
            buttonFontFamily={branding.font_button || branding.font_heading}
            buttonFontWeight={branding.font_button_weight || branding.font_heading_weight}
          />
        </div>
      </div>
    </ViewerPagePreview>
  );
}
