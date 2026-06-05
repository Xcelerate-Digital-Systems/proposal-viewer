// components/admin/shared/design-tab/ViewerStyleSection.tsx
// Design tab restructured into named groups matching the new spec:
//   1. Globals     — orientation, page-number badge, background image
//   2. Cover Page  — placeholder; cover design still lives on the Cover tab
//                    until Phase 1.5 of the design-tab consolidation lands
//   3. Text Page   — title font, text-page colours
//   4. Packages    — placeholder; per-package styling still on the Packages tab
//   5. Quote Pages — note; quote pages inherit from text-page styling
//
// DesignTab.tsx still owns all state — this component is pure presentation.
'use client';

import { useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import {
  Loader2, Upload, Trash2, ChevronDown,
  Image as ImageIcon, RotateCcw, Hash, LayoutPanelTop,
  Paintbrush, Package, DollarSign, ArrowUpRight, CheckSquare,
} from 'lucide-react';
import Link from 'next/link';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import FontSelect from '@/components/admin/shared/FontSelect';
import Slider from '@/components/ui/Slider';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import CoverDesignPanel from '@/components/admin/builder-sections/CoverDesignPanel';
import PackagesDesignPanel from '@/components/admin/builder-sections/PackagesDesignPanel';
import { PricingDesignPreview, DecisionDesignPreview, type FontLiveOverrides } from '@/components/admin/builder-sections/DesignPreviews';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import type { CoverEditorEntity } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import {
  EntityType, PageOrientation, TextPageDefaults,
  orientationOptions, SaveStatus,
} from './DesignTabTypes';

/* ------------------------------------------------------------------ */
/*  FontSizeInput — number input with a px suffix                      */
/* ------------------------------------------------------------------ */

function FontSizeInput({
  label,
  value,
  onChange,
  placeholder,
  min = 8,
  max = 96,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-prose">{label}</label>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-3 pr-9 py-2 text-sm border border-edge-strong rounded-lg bg-white text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-detail text-faint pointer-events-none">px</span>
      </div>
      <p className="text-detail text-faint">Leave blank to use the workspace default.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TipTap → plain text                                                */
/* ------------------------------------------------------------------ */

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

/** Flatten a TipTap document to plain text. Walks `content` recursively and
 *  concatenates `text` nodes, inserting a space between block siblings. */
function tipTapToPlainText(node: unknown): string {
  const n = node as TipTapNode | null;
  if (!n) return '';
  if (typeof n.text === 'string') return n.text;
  if (!Array.isArray(n.content)) return '';
  return n.content
    .map((child) => tipTapToPlainText(child))
    .filter(Boolean)
    .join(' ');
}

/* ------------------------------------------------------------------ */
/*  Group heading                                                      */
/* ------------------------------------------------------------------ */

function GroupHeading({ title, hint, open, onToggle }: { title: string; hint?: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full pt-4 text-left group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          <h3 className="text-xl font-semibold text-ink">{title}</h3>
          {hint && <span className="text-xs text-faint">{hint}</span>}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-faint group-hover:text-dim transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      <div className="mt-2 h-px bg-edge" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ViewerStyleSectionProps {
  type: EntityType;
  saveStatus: SaveStatus;
  /* ── Orientation ────────────────────────────────────────── */
  pageOrientation: PageOrientation;
  setPageOrientation: (v: PageOrientation) => void;
  /* ── Background image ───────────────────────────────────── */
  bgMode: 'company' | 'custom';
  setBgMode: (v: 'company' | 'custom') => void;
  bgImageUrl: string | null;
  uploading: boolean;
  overlayOpacity: number;
  setOverlayOpacity: (v: number) => void;
  bgImageBlur: number;
  setBgImageBlur: (v: number) => void;
  companyBgPrimary: string;
  previewImageUrl: string | null;
  previewOpacity: number;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onBgResetToCompany: () => void;
  /* ── Title font ─────────────────────────────────────────── */
  titleFontFamily: string | null;
  setTitleFontFamily: (v: string | null) => void;
  titleFontWeight: string | null;
  setTitleFontWeight: (v: string | null) => void;
  titleFontSize: string;
  setTitleFontSize: (v: string) => void;
  /* ── Heading + body fonts (entity overrides) ───────────── */
  fontHeadingFamily: string | null;
  setFontHeadingFamily: (v: string | null) => void;
  fontHeadingWeight: string | null;
  setFontHeadingWeight: (v: string | null) => void;
  fontBodyFamily: string | null;
  setFontBodyFamily: (v: string | null) => void;
  fontBodyWeight: string | null;
  setFontBodyWeight: (v: string | null) => void;
  fontButtonFamily: string | null;
  setFontButtonFamily: (v: string | null) => void;
  fontButtonWeight: string | null;
  setFontButtonWeight: (v: string | null) => void;
  fontHeadingSize: string;
  setFontHeadingSize: (v: string) => void;
  fontBodySize: string;
  setFontBodySize: (v: string) => void;
  /* ── Font case transforms (Normal / Upper / Lower / Title) ── */
  titleFontTransform: string | null;
  setTitleFontTransform: (v: string | null) => void;
  fontHeadingTransform: string | null;
  setFontHeadingTransform: (v: string | null) => void;
  fontBodyTransform: string | null;
  setFontBodyTransform: (v: string | null) => void;
  /* ── Text page colors ───────────────────────────────────── */
  tpBgColor: string;
  setTpBgColor: (v: string) => void;
  tpTextColor: string;
  setTpTextColor: (v: string) => void;
  tpHeadingColor: string;
  setTpHeadingColor: (v: string) => void;
  /* ── Page number badge colors ───────────────────────────── */
  pageNumCircleColor: string | null;
  setPageNumCircleColor: (v: string | null) => void;
  pageNumTextColor: string | null;
  setPageNumTextColor: (v: string | null) => void;
  /* ── Proposal pricing-page colours (proposals + templates) ── */
  pricingHeaderTextColor: string | null;
  setPricingHeaderTextColor: (v: string | null) => void;
  pricingTextColor: string | null;
  setPricingTextColor: (v: string | null) => void;
  pricingPriceTitleColor: string | null;
  setPricingPriceTitleColor: (v: string | null) => void;
  pricingPriceColor: string | null;
  setPricingPriceColor: (v: string | null) => void;
  pricingPaymentScheduleNameColor: string | null;
  setPricingPaymentScheduleNameColor: (v: string | null) => void;
  pricingPaymentSchedulePriceColor: string | null;
  setPricingPaymentSchedulePriceColor: (v: string | null) => void;
  pricingAccentBarColor: string | null;
  setPricingAccentBarColor: (v: string | null) => void;
  pricingDotColor: string | null;
  setPricingDotColor: (v: string | null) => void;
  /* ── Defaults & actions ─────────────────────────────────── */
  companyDefaults: TextPageDefaults;
  onTpResetToCompany: () => void;
  /* ── Routing context for cross-tab links ───────────────── */
  entityId: string;
  /** Entity title — surfaced in the Globals live preview so the user sees
   *  their actual title in the chosen font instead of "Sample page title". */
  entityTitle?: string;
  /* ── Decision-page colours (proposals + templates) ──────── */
  decisionBgColor: string | null;
  setDecisionBgColor: (v: string | null) => void;
  decisionTextColor: string | null;
  setDecisionTextColor: (v: string | null) => void;
  decisionHeadingColor: string | null;
  setDecisionHeadingColor: (v: string | null) => void;
  decisionAcceptButtonColor: string | null;
  setDecisionAcceptButtonColor: (v: string | null) => void;
  decisionDeclineButtonColor: string | null;
  setDecisionDeclineButtonColor: (v: string | null) => void;
  decisionRevisionButtonColor: string | null;
  setDecisionRevisionButtonColor: (v: string | null) => void;
  decisionCheckboxColor: string | null;
  setDecisionCheckboxColor: (v: string | null) => void;
  /* ── Cover design panel — rendered when caller passes the
        cover entity. Documents/quotes don't pass it. ──── */
  coverEntity?: CoverEditorEntity;
  onCoverSave?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ViewerStyleSection({
  type,
  pageOrientation,
  setPageOrientation,
  bgMode,
  setBgMode,
  bgImageUrl,
  uploading,
  overlayOpacity,
  setOverlayOpacity,
  bgImageBlur,
  setBgImageBlur,
  onUpload,
  onRemove,
  onBgResetToCompany,
  titleFontFamily,
  setTitleFontFamily,
  titleFontWeight,
  setTitleFontWeight,
  titleFontSize,
  setTitleFontSize,
  fontHeadingFamily,
  setFontHeadingFamily,
  fontHeadingWeight,
  setFontHeadingWeight,
  fontBodyFamily,
  setFontBodyFamily,
  fontBodyWeight,
  setFontBodyWeight,
  fontButtonFamily,
  setFontButtonFamily,
  fontButtonWeight,
  setFontButtonWeight,
  fontHeadingSize,
  setFontHeadingSize,
  fontBodySize,
  setFontBodySize,
  titleFontTransform,
  setTitleFontTransform,
  fontHeadingTransform,
  setFontHeadingTransform,
  fontBodyTransform,
  setFontBodyTransform,
  tpBgColor,
  setTpBgColor,
  tpTextColor,
  setTpTextColor,
  tpHeadingColor,
  setTpHeadingColor,
  pageNumCircleColor,
  setPageNumCircleColor,
  pageNumTextColor,
  setPageNumTextColor,
  pricingHeaderTextColor,
  setPricingHeaderTextColor,
  pricingTextColor,
  setPricingTextColor,
  pricingPriceTitleColor,
  setPricingPriceTitleColor,
  pricingPriceColor,
  setPricingPriceColor,
  pricingPaymentScheduleNameColor,
  setPricingPaymentScheduleNameColor,
  pricingPaymentSchedulePriceColor,
  setPricingPaymentSchedulePriceColor,
  pricingAccentBarColor,
  setPricingAccentBarColor,
  pricingDotColor,
  setPricingDotColor,
  companyDefaults,
  onTpResetToCompany,
  entityId,
  entityTitle,
  decisionBgColor,
  setDecisionBgColor,
  decisionTextColor,
  setDecisionTextColor,
  decisionHeadingColor,
  setDecisionHeadingColor,
  decisionAcceptButtonColor,
  setDecisionAcceptButtonColor,
  decisionDeclineButtonColor,
  setDecisionDeclineButtonColor,
  decisionRevisionButtonColor,
  setDecisionRevisionButtonColor,
  decisionCheckboxColor,
  setDecisionCheckboxColor,
  coverEntity,
  onCoverSave,
}: ViewerStyleSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const liveFonts: FontLiveOverrides = {
    title_font_family: titleFontFamily,
    title_font_weight: titleFontWeight,
    title_font_size: titleFontSize || null,
    font_heading: fontHeadingFamily,
    font_heading_weight: fontHeadingWeight,
    font_heading_size: fontHeadingSize || null,
    font_body: fontBodyFamily,
    font_body_weight: fontBodyWeight,
    font_body_size: fontBodySize || null,
    font_button: fontButtonFamily,
    font_button_weight: fontButtonWeight,
    title_font_transform: titleFontTransform,
    font_heading_transform: fontHeadingTransform,
    font_body_transform: fontBodyTransform,
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['Globals']));
  const toggleGroup = (name: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const [bodySnippet, setBodySnippet] = useState<string | null>(null);
  useEffect(() => {
    if (!entityId) return;
    const apiBase = type === 'template' ? '/api/templates/pages' : '/api/proposals/pages';
    const key = type === 'template' ? 'template_id' : 'proposal_id';
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${apiBase}?${key}=${entityId}`);
        if (!res.ok || cancelled) return;
        const pages = await res.json() as Array<{ type: string; position: number; payload?: { content?: unknown } }>;
        const first = pages.filter((p) => p.type === 'text').sort((a, b) => a.position - b.position)[0];
        if (!first?.payload?.content) return;
        const text = tipTapToPlainText(first.payload.content).trim();
        if (text && !cancelled) setBodySnippet(text.slice(0, 240));
      } catch { /* keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, [entityId, type]);
  const basePath = type === 'template' ? `/templates/${entityId}` : `/proposals/${entityId}`;

  /* ── Reusable Background Image block (used inside Text Page card) ── */
  const backgroundImageBlock = (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['company', 'custom'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setBgMode(mode)}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
              bgMode === mode
                ? 'bg-teal/10 border-teal/40 text-teal font-medium'
                : 'bg-white border-edge-strong text-dim hover:bg-surface'
            }`}
          >
            {mode === 'company' ? 'Use company default' : 'Custom'}
          </button>
        ))}
      </div>

      {bgMode === 'custom' && (
        <>
          {bgImageUrl ? (
            <div className="flex items-start gap-3">
              <div
                className="w-20 h-14 rounded-lg border border-edge-strong bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${bgImageUrl})` }}
              />
              <div className="space-y-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-prose bg-surface border border-edge-strong rounded-lg hover:bg-surface disabled:opacity-50 transition-colors"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Replace
                </button>
                <button
                  onClick={onRemove}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-edge-strong text-faint hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              <span className="text-xs font-medium">Upload background image</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />

          <Slider
            label="Colour overlay opacity"
            value={Math.round(overlayOpacity * 100)}
            formatValue={(v) => `${v}%`}
            hint="How much the page background colour tints the image. 0% = no tint."
            onChange={(pct) => setOverlayOpacity(pct / 100)}
          />
          <Slider
            label="Blur"
            value={bgImageBlur}
            max={20}
            formatValue={(v) => (v > 0 ? `${v}px` : 'Off')}
            onChange={setBgImageBlur}
          />

          <button
            onClick={onBgResetToCompany}
            className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
          >
            <RotateCcw size={12} />
            Reset to company default
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ============================================================
          1. GLOBALS — truly cross-cutting controls
          ============================================================ */}
      <GroupHeading title="Globals" hint="Apply across every page" open={openGroups.has('Globals')} onToggle={() => toggleGroup('Globals')} />

      {openGroups.has('Globals') && <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-5">
          <SectionCard
            title="Global Page Defaults"
            description="Orientation, typography, and a shared background image — applied behind text, pricing, and packages pages."
            icon={<LayoutPanelTop size={14} className="text-faint" />}
          >
            <div className="space-y-5">
              {/* Orientation — compact chip row */}
              <div>
                <p className="text-detail font-semibold text-dim uppercase tracking-wider mb-2">Orientation</p>
                <div className="flex gap-2">
                  {orientationOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setPageOrientation(opt.key)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        pageOrientation === opt.key
                          ? 'bg-teal/10 border-teal/40 text-teal font-medium'
                          : 'bg-white border-edge-strong text-dim hover:bg-surface'
                      }`}
                    >
                      <span className={`rounded-sm border-2 flex-shrink-0 ${
                        pageOrientation === opt.key ? 'border-teal' : 'border-edge-hover'
                      } ${opt.key === 'landscape' ? 'w-4 h-3.5' : 'w-3.5 h-4'}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography — 3 fonts grouped together. hidePreview drops the
                  per-font inline preview tile (the sticky aside shows them now). */}
              <div className="pt-4 border-t border-edge">
                <p className="text-detail font-semibold text-dim uppercase tracking-wider mb-3">Typography</p>
                <div className="space-y-4">
                  <FontSelect
                    label="Page title font"
                    description="The big H1 at the top of every page. Leave blank to use the Heading font."
                    value={titleFontFamily}
                    onChange={setTitleFontFamily}
                    weight={titleFontWeight}
                    onWeightChange={setTitleFontWeight}
                    transform={titleFontTransform}
                    onTransformChange={setTitleFontTransform}
                    hideInlinePreview
                  />
                  <FontSizeInput
                    label="Title size"
                    value={titleFontSize}
                    onChange={setTitleFontSize}
                    placeholder="36"
                  />
                  <FontSelect
                    label="Heading font"
                    description={
                      companyDefaults.font_heading
                        ? `Section H2/H3 inside body. Workspace default: ${companyDefaults.font_heading}.`
                        : 'Section H2/H3 inside body. Leave blank to inherit the workspace default.'
                    }
                    value={fontHeadingFamily}
                    onChange={setFontHeadingFamily}
                    weight={fontHeadingWeight}
                    onWeightChange={setFontHeadingWeight}
                    transform={fontHeadingTransform}
                    onTransformChange={setFontHeadingTransform}
                    hideInlinePreview
                  />
                  <FontSizeInput
                    label="Heading size"
                    value={fontHeadingSize}
                    onChange={setFontHeadingSize}
                    placeholder="18"
                  />
                  <FontSelect
                    label="Body font"
                    description={
                      companyDefaults.font_body
                        ? `Paragraph copy. Workspace default: ${companyDefaults.font_body}.`
                        : 'Paragraph copy. Leave blank to inherit the workspace default.'
                    }
                    value={fontBodyFamily}
                    onChange={setFontBodyFamily}
                    weight={fontBodyWeight}
                    onWeightChange={setFontBodyWeight}
                    transform={fontBodyTransform}
                    onTransformChange={setFontBodyTransform}
                    hideInlinePreview
                  />
                  <FontSizeInput
                    label="Body size"
                    value={fontBodySize}
                    onChange={setFontBodySize}
                    placeholder={companyDefaults.font_size || '14'}
                  />
                  <FontSelect
                    label="Button font"
                    description="Cover call-to-action button. Leave blank to use the Heading font."
                    value={fontButtonFamily}
                    onChange={setFontButtonFamily}
                    weight={fontButtonWeight}
                    onWeightChange={setFontButtonWeight}
                    hideInlinePreview
                  />
                </div>
              </div>

              {/* Background image */}
              <div className="pt-4 border-t border-edge">
                <p className="text-detail font-semibold text-dim uppercase tracking-wider mb-2">Background Image</p>
                {backgroundImageBlock}
              </div>
            </div>
          </SectionCard>

          {/* Page Colours — body bg / body text / heading. Pulled out of the
              Global Page Defaults card so every colour-selector group on this
              tab follows the same flat ColorPickerField stack the Pricing
              Design card uses. */}
          <SectionCard
            title="Page Colours"
            description="Background, body text and headings. Applies to text, pricing and packages pages."
            icon={<Paintbrush size={14} className="text-faint" />}
            action={
              <button
                onClick={onTpResetToCompany}
                className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            }
          >
            <div className="space-y-4">
              <ColorPickerField
                label="Background"
                value={tpBgColor}
                fallback={companyDefaults.bg_color}
                onChange={setTpBgColor}
              />
              <ColorPickerField
                label="Body Text"
                value={tpTextColor}
                fallback={companyDefaults.text_color}
                onChange={setTpTextColor}
              />
              <ColorPickerField
                label="Headings"
                value={tpHeadingColor}
                fallback={companyDefaults.heading_color || companyDefaults.text_color}
                onChange={setTpHeadingColor}
              />
            </div>
          </SectionCard>

          {/* Page Number Badge — body pages only; sits alongside Globals so it
              shares the typography preview aside. */}
          <SectionCard
            title="Page Number Badge"
            description="Leave blank to use your accent colour (circle) and white (text)."
            icon={<Hash size={14} className="text-faint" />}
            action={
              <button
                onClick={() => {
                  setPageNumCircleColor(null);
                  setPageNumTextColor(null);
                }}
                className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            }
          >
            <div className="space-y-4">
              <ColorPickerField
                label="Circle Colour"
                value={pageNumCircleColor}
                fallback={companyDefaults.accent_color}
                onChange={setPageNumCircleColor}
                onReset={() => setPageNumCircleColor(null)}
              />
              <ColorPickerField
                label="Text Colour"
                value={pageNumTextColor}
                fallback="#ffffff"
                onChange={setPageNumTextColor}
                onReset={() => setPageNumTextColor(null)}
              />
            </div>
          </SectionCard>
        </div>

        <StickyPreviewAside>
          <GoogleFontLoader fonts={[
            titleFontFamily || fontHeadingFamily || companyDefaults.font_heading,
            fontHeadingFamily || companyDefaults.font_heading,
            fontBodyFamily || companyDefaults.font_body,
          ]} />
          <div
            className="rounded-lg overflow-hidden border border-edge-strong bg-surface p-8 space-y-4"
            style={{ backgroundColor: tpBgColor || companyDefaults.bg_color }}
          >
            <p
              className="leading-tight"
              style={{
                color: tpHeadingColor || companyDefaults.heading_color || companyDefaults.text_color,
                fontFamily: fontFamily(titleFontFamily || fontHeadingFamily || companyDefaults.font_heading, 'system-ui, sans-serif'),
                fontWeight: Number(titleFontWeight || fontHeadingWeight || '600'),
                fontSize: titleFontSize ? `${titleFontSize}px` : '36px',
                textTransform: (titleFontTransform || fontHeadingTransform || 'none') as React.CSSProperties['textTransform'],
              }}
            >
              {entityTitle || 'Sample page title'}
            </p>
            <p
              className="leading-snug"
              style={{
                color: tpHeadingColor || companyDefaults.heading_color || companyDefaults.text_color,
                fontFamily: fontFamily(fontHeadingFamily || companyDefaults.font_heading, 'system-ui, sans-serif'),
                fontWeight: fontHeadingWeight ? Number(fontHeadingWeight) : undefined,
                fontSize: fontHeadingSize ? `${fontHeadingSize}px` : '22px',
                textTransform: (fontHeadingTransform || 'none') as React.CSSProperties['textTransform'],
              }}
            >
              A section heading
            </p>
            <p
              className="leading-relaxed"
              style={{
                color: tpTextColor || companyDefaults.text_color,
                fontFamily: fontFamily(fontBodyFamily || companyDefaults.font_body, 'system-ui, sans-serif'),
                fontWeight: Number(fontBodyWeight || '400'),
                fontSize: fontBodySize ? `${fontBodySize}px` : `${companyDefaults.font_size || '15'}px`,
                textTransform: (fontBodyTransform || 'none') as React.CSSProperties['textTransform'],
              }}
            >
              {bodySnippet || 'Body text on a proposal page. This is what your client will read — adjust the body font, weight, and colour to match your brand voice.'}
            </p>
          </div>
        </StickyPreviewAside>
      </div>}

      {/* ============================================================
          2. COVER PAGE
          ============================================================ */}
      <GroupHeading title="Cover Page" hint="Logo, avatar and titles live in the Cover tab" open={openGroups.has('Cover Page')} onToggle={() => toggleGroup('Cover Page')} />

      {openGroups.has('Cover Page') && (coverEntity ? (
        <CoverDesignPanel
          type={type === 'document' ? 'document' : type}
          entity={coverEntity}
          onSave={onCoverSave}
          liveTitleFontFamily={titleFontFamily}
          liveTitleFontWeight={titleFontWeight}
          liveFontHeadingFamily={fontHeadingFamily}
          liveFontHeadingWeight={fontHeadingWeight}
          liveFontBodyFamily={fontBodyFamily}
          liveFontBodyWeight={fontBodyWeight}
          liveFontButtonFamily={fontButtonFamily}
          liveFontButtonWeight={fontButtonWeight}
        />
      ) : (
        <SectionCard
          title="Cover Design"
          description="Cover-specific colours, background image, and gradient."
          icon={<Paintbrush size={14} className="text-faint" />}
          action={
            <Link
              href={`${basePath}/cover`}
              className="flex items-center gap-1 text-xs font-medium text-teal hover:underline"
            >
              Open Cover tab <ArrowUpRight size={12} />
            </Link>
          }
        >
          <p className="text-xs text-faint">
            Cover design controls appear here when the page passes a cover entity.
          </p>
        </SectionCard>
      ))}

      {/* ============================================================
          3. PRICING PAGE — quote pages
          ============================================================ */}
      {type !== 'document' && (
        <>
          <GroupHeading title="Pricing Page" hint="Line item table, totals, payment schedule" open={openGroups.has('Pricing Page')} onToggle={() => toggleGroup('Pricing Page')} />

          {openGroups.has('Pricing Page') && <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0">
              <SectionCard
                title="Pricing Design"
                description="Colour the pricing page that appears inside the proposal. Body background, card chrome and headings still inherit from Globals."
                icon={<DollarSign size={14} className="text-faint" />}
                action={
                  <button
                    onClick={() => {
                      setPricingHeaderTextColor(null);
                      setPricingTextColor(null);
                      setPricingPriceTitleColor(null);
                      setPricingPriceColor(null);
                      setPricingPaymentScheduleNameColor(null);
                      setPricingPaymentSchedulePriceColor(null);
                      setPricingAccentBarColor(null);
                      setPricingDotColor(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                }
              >
                <div className="space-y-4">
                  <ColorPickerField
                    label="Header Text"
                    value={pricingHeaderTextColor}
                    fallback={companyDefaults.heading_color || companyDefaults.text_color}
                    onChange={setPricingHeaderTextColor}
                    onReset={() => setPricingHeaderTextColor(null)}
                  />
                  <ColorPickerField
                    label="Text"
                    value={pricingTextColor}
                    fallback={companyDefaults.text_color}
                    onChange={setPricingTextColor}
                    onReset={() => setPricingTextColor(null)}
                  />
                  <ColorPickerField
                    label="Price Title"
                    value={pricingPriceTitleColor}
                    fallback={companyDefaults.heading_color || companyDefaults.text_color}
                    onChange={setPricingPriceTitleColor}
                    onReset={() => setPricingPriceTitleColor(null)}
                  />
                  <ColorPickerField
                    label="Price"
                    value={pricingPriceColor}
                    fallback={companyDefaults.heading_color || companyDefaults.text_color}
                    onChange={setPricingPriceColor}
                    onReset={() => setPricingPriceColor(null)}
                  />
                  <ColorPickerField
                    label="Payment Schedule Name"
                    value={pricingPaymentScheduleNameColor}
                    fallback={companyDefaults.accent_color}
                    onChange={setPricingPaymentScheduleNameColor}
                    onReset={() => setPricingPaymentScheduleNameColor(null)}
                  />
                  <ColorPickerField
                    label="Payment Schedule Price"
                    value={pricingPaymentSchedulePriceColor}
                    fallback={companyDefaults.accent_color}
                    onChange={setPricingPaymentSchedulePriceColor}
                    onReset={() => setPricingPaymentSchedulePriceColor(null)}
                  />
                  <ColorPickerField
                    label="Top Border Bar"
                    value={pricingAccentBarColor}
                    fallback={companyDefaults.accent_color}
                    onChange={setPricingAccentBarColor}
                    onReset={() => setPricingAccentBarColor(null)}
                  />
                  <ColorPickerField
                    label="Dot / Bullet Colour"
                    value={pricingDotColor}
                    fallback={companyDefaults.accent_color}
                    onChange={setPricingDotColor}
                    onReset={() => setPricingDotColor(null)}
                  />
                </div>
              </SectionCard>
            </div>
            <StickyPreviewAside>
              <PricingDesignPreview
                entityId={entityId}
                entityKey={type === 'template' ? 'template_id' : 'proposal_id'}
                live={{
                  pricing_header_text_color: pricingHeaderTextColor,
                  pricing_text_color: pricingTextColor,
                  pricing_price_title_color: pricingPriceTitleColor,
                  pricing_price_color: pricingPriceColor,
                  pricing_payment_schedule_name_color: pricingPaymentScheduleNameColor,
                  pricing_payment_schedule_price_color: pricingPaymentSchedulePriceColor,
                  pricing_accent_bar_color: pricingAccentBarColor,
                  pricing_dot_color: pricingDotColor,
                }}
                liveFonts={liveFonts}
              />
            </StickyPreviewAside>
          </div>}
        </>
      )}

      {/* ============================================================
          4. PACKAGE PAGE
          ============================================================ */}
      <GroupHeading title="Package Page" hint="Gradient picker, feature icons, tier colours" open={openGroups.has('Package Page')} onToggle={() => toggleGroup('Package Page')} />

      {openGroups.has('Package Page') && (type === 'document' ? (
        <SectionCard
          title="Packages Design"
          description="Documents don't have packages pages."
          icon={<Package size={14} className="text-faint" />}
        >
          <p className="text-xs text-faint">Not applicable to documents.</p>
        </SectionCard>
      ) : (
        <PackagesDesignPanel
          entityId={entityId}
          entityKey={type === 'template' ? 'template_id' : 'proposal_id'}
        />
      ))}

      {/* Decision design is now at company level (Brand Kit). */}

    </div>
  );
}
