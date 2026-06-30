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
  Loader2, Upload, Trash2,
  Image as ImageIcon, RotateCcw,
} from 'lucide-react';
import Slider from '@/components/ui/Slider';
import type { FontLiveOverrides } from '@/components/admin/builder-sections/DesignPreviews';
import type { CoverEditorEntity } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import {
  EntityType, PageOrientation, TextPageDefaults, SaveStatus,
} from './DesignTabTypes';
import { GroupHeading, tipTapToPlainText } from './design-helpers';
import GlobalsGroup from './GlobalsGroup';
import CoverGroup from './CoverGroup';
import PricingGroup from './PricingGroup';
import PackageGroup from './PackageGroup';

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
  const entityKey = type === 'template' ? 'template_id' as const : 'proposal_id' as const;

  /* ── Reusable Background Image block (passed to GlobalsGroup) ── */
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

      {openGroups.has('Globals') && (
        <GlobalsGroup
          pageOrientation={pageOrientation}
          setPageOrientation={setPageOrientation}
          titleFontFamily={titleFontFamily}
          setTitleFontFamily={setTitleFontFamily}
          titleFontWeight={titleFontWeight}
          setTitleFontWeight={setTitleFontWeight}
          titleFontSize={titleFontSize}
          setTitleFontSize={setTitleFontSize}
          titleFontTransform={titleFontTransform}
          setTitleFontTransform={setTitleFontTransform}
          fontHeadingFamily={fontHeadingFamily}
          setFontHeadingFamily={setFontHeadingFamily}
          fontHeadingWeight={fontHeadingWeight}
          setFontHeadingWeight={setFontHeadingWeight}
          fontHeadingSize={fontHeadingSize}
          setFontHeadingSize={setFontHeadingSize}
          fontHeadingTransform={fontHeadingTransform}
          setFontHeadingTransform={setFontHeadingTransform}
          fontBodyFamily={fontBodyFamily}
          setFontBodyFamily={setFontBodyFamily}
          fontBodyWeight={fontBodyWeight}
          setFontBodyWeight={setFontBodyWeight}
          fontBodySize={fontBodySize}
          setFontBodySize={setFontBodySize}
          fontBodyTransform={fontBodyTransform}
          setFontBodyTransform={setFontBodyTransform}
          fontButtonFamily={fontButtonFamily}
          setFontButtonFamily={setFontButtonFamily}
          fontButtonWeight={fontButtonWeight}
          setFontButtonWeight={setFontButtonWeight}
          tpBgColor={tpBgColor}
          setTpBgColor={setTpBgColor}
          tpTextColor={tpTextColor}
          setTpTextColor={setTpTextColor}
          tpHeadingColor={tpHeadingColor}
          setTpHeadingColor={setTpHeadingColor}
          pageNumCircleColor={pageNumCircleColor}
          setPageNumCircleColor={setPageNumCircleColor}
          pageNumTextColor={pageNumTextColor}
          setPageNumTextColor={setPageNumTextColor}
          companyDefaults={companyDefaults}
          onTpResetToCompany={onTpResetToCompany}
          backgroundImageBlock={backgroundImageBlock}
          entityTitle={entityTitle}
          bodySnippet={bodySnippet}
        />
      )}

      {/* ============================================================
          2. COVER PAGE
          ============================================================ */}
      <GroupHeading title="Cover Page" hint="Logo, avatar and titles live in the Cover tab" open={openGroups.has('Cover Page')} onToggle={() => toggleGroup('Cover Page')} />

      {openGroups.has('Cover Page') && (
        <CoverGroup
          type={type}
          basePath={basePath}
          coverEntity={coverEntity}
          onCoverSave={onCoverSave}
          liveTitleFontFamily={titleFontFamily}
          liveTitleFontWeight={titleFontWeight}
          liveFontHeadingFamily={fontHeadingFamily}
          liveFontHeadingWeight={fontHeadingWeight}
          liveFontBodyFamily={fontBodyFamily}
          liveFontBodyWeight={fontBodyWeight}
          liveFontButtonFamily={fontButtonFamily}
          liveFontButtonWeight={fontButtonWeight}
        />
      )}

      {/* ============================================================
          3. PRICING PAGE — quote pages
          ============================================================ */}
      {type !== 'document' && (
        <>
          <GroupHeading title="Pricing Page" hint="Line item table, totals, payment schedule" open={openGroups.has('Pricing Page')} onToggle={() => toggleGroup('Pricing Page')} />

          {openGroups.has('Pricing Page') && (
            <PricingGroup
              entityId={entityId}
              entityKey={entityKey}
              companyDefaults={companyDefaults}
              liveFonts={liveFonts}
              pricingHeaderTextColor={pricingHeaderTextColor}
              setPricingHeaderTextColor={setPricingHeaderTextColor}
              pricingTextColor={pricingTextColor}
              setPricingTextColor={setPricingTextColor}
              pricingPriceTitleColor={pricingPriceTitleColor}
              setPricingPriceTitleColor={setPricingPriceTitleColor}
              pricingPriceColor={pricingPriceColor}
              setPricingPriceColor={setPricingPriceColor}
              pricingPaymentScheduleNameColor={pricingPaymentScheduleNameColor}
              setPricingPaymentScheduleNameColor={setPricingPaymentScheduleNameColor}
              pricingPaymentSchedulePriceColor={pricingPaymentSchedulePriceColor}
              setPricingPaymentSchedulePriceColor={setPricingPaymentSchedulePriceColor}
              pricingAccentBarColor={pricingAccentBarColor}
              setPricingAccentBarColor={setPricingAccentBarColor}
              pricingDotColor={pricingDotColor}
              setPricingDotColor={setPricingDotColor}
            />
          )}
        </>
      )}

      {/* ============================================================
          4. PACKAGE PAGE
          ============================================================ */}
      <GroupHeading title="Package Page" hint="Gradient picker, feature icons, tier colours" open={openGroups.has('Package Page')} onToggle={() => toggleGroup('Package Page')} />

      {openGroups.has('Package Page') && (
        <PackageGroup
          type={type}
          entityId={entityId}
          entityKey={entityKey}
        />
      )}

      {/* Decision design is now at company level (Brand Kit). */}

    </div>
  );
}
