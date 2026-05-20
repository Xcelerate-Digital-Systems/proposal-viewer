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

import { useRef } from 'react';
import {
  Loader2, Upload, Trash2,
  Image as ImageIcon, RotateCcw, Type, Palette, Hash, LayoutPanelTop,
  Paintbrush, Package, DollarSign, ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { fontFamily } from '@/lib/google-fonts';
import FontSelect from '@/components/admin/shared/FontSelect';
import Slider from '@/components/ui/Slider';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import CoverDesignPanel from '@/components/admin/builder-sections/CoverDesignPanel';
import PackagesDesignPanel from '@/components/admin/builder-sections/PackagesDesignPanel';
import { PricingDesignPreview, TextPageDesignPreview } from '@/components/admin/builder-sections/DesignPreviews';
import type { CoverEditorEntity } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import {
  EntityType, PageOrientation, TextPageDefaults,
  orientationOptions, SaveStatus,
} from './DesignTabTypes';

/* ------------------------------------------------------------------ */
/*  Group heading                                                      */
/* ------------------------------------------------------------------ */

function GroupHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="pt-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      <div className="mt-2 h-px bg-gray-200" />
    </div>
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
  /* ── Defaults & actions ─────────────────────────────────── */
  companyDefaults: TextPageDefaults;
  onTpResetToCompany: () => void;
  /* ── Routing context for cross-tab links ───────────────── */
  entityId: string;
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
  companyDefaults,
  onTpResetToCompany,
  entityId,
  coverEntity,
  onCoverSave,
}: ViewerStyleSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
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
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
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
                className="w-20 h-14 rounded-lg border border-gray-200 bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${bgImageUrl})` }}
              />
              <div className="space-y-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
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
              className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
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
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal transition-colors"
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
      <GroupHeading title="Globals" hint="Apply across every page" />

      {/* Globals — same flex+aside shape as Text Page Colours / Pricing Design.
          Controls live inside a single SectionCard on the left; the live
          typography preview is a sticky sibling aside on the right. */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-5">
          <SectionCard
            title="Global Page Defaults"
            description="Orientation, typography, and a shared background image — applied behind text, pricing, and packages pages."
            icon={<LayoutPanelTop size={14} className="text-gray-400" />}
          >
            <div className="space-y-5">
              {/* Orientation — compact chip row */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Orientation</p>
                <div className="flex gap-2">
                  {orientationOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setPageOrientation(opt.key)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        pageOrientation === opt.key
                          ? 'bg-teal/10 border-teal/40 text-teal font-medium'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`rounded-sm border-2 flex-shrink-0 ${
                        pageOrientation === opt.key ? 'border-teal' : 'border-gray-300'
                      } ${opt.key === 'landscape' ? 'w-4 h-3.5' : 'w-3.5 h-4'}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography — 3 fonts grouped together. hidePreview drops the
                  per-font inline preview tile (the sticky aside shows them now). */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Typography</p>
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
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Title size</label>
                    <select
                      value={titleFontSize}
                      onChange={(e) => setTitleFontSize(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal/30"
                    >
                      <option value="">Default</option>
                      <option value="20">20px — Small</option>
                      <option value="24">24px — Medium</option>
                      <option value="28">28px</option>
                      <option value="32">32px — Large</option>
                      <option value="36">36px</option>
                      <option value="40">40px — Extra Large</option>
                      <option value="48">48px</option>
                    </select>
                  </div>
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
                </div>
              </div>

              {/* Background image */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Background Image</p>
                {backgroundImageBlock}
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
          <div className="sticky top-6">
            <div
              className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 p-8 space-y-4"
              style={{ backgroundColor: tpBgColor || companyDefaults.bg_color }}
            >
              <p
                className="leading-tight"
                style={{
                  color: tpHeadingColor || companyDefaults.heading_color || companyDefaults.text_color,
                  fontFamily: fontFamily(titleFontFamily || fontHeadingFamily || companyDefaults.font_heading, 'system-ui, sans-serif'),
                  fontWeight: Number(titleFontWeight || fontHeadingWeight || '700'),
                  fontSize: titleFontSize ? `${titleFontSize}px` : '36px',
                  textTransform: (titleFontTransform || fontHeadingTransform || 'none') as React.CSSProperties['textTransform'],
                }}
              >
                Sample page title
              </p>
              <p
                className="leading-snug"
                style={{
                  color: tpHeadingColor || companyDefaults.heading_color || companyDefaults.text_color,
                  fontFamily: fontFamily(fontHeadingFamily || companyDefaults.font_heading, 'system-ui, sans-serif'),
                  fontWeight: Number(fontHeadingWeight || '600'),
                  fontSize: '22px',
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
                  fontSize: '15px',
                  textTransform: (fontBodyTransform || 'none') as React.CSSProperties['textTransform'],
                }}
              >
                Body text on a proposal page. This is what your client will read — adjust the body font, weight, and colour to match your brand voice.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ============================================================
          2. COVER PAGE
          ============================================================ */}
      <GroupHeading title="Cover Page" hint="Logo, avatar and titles live in the Cover tab" />

      {coverEntity ? (
        <CoverDesignPanel
          type={type === 'document' ? 'document' : type}
          entity={coverEntity}
          onSave={onCoverSave}
        />
      ) : (
        <SectionCard
          title="Cover Design"
          description="Cover-specific colours, background image, and gradient."
          icon={<Paintbrush size={14} className="text-gray-400" />}
          action={
            <Link
              href={`${basePath}/cover`}
              className="flex items-center gap-1 text-xs font-medium text-teal hover:underline"
            >
              Open Cover tab <ArrowUpRight size={12} />
            </Link>
          }
        >
          <p className="text-xs text-gray-400">
            Cover design controls appear here when the page passes a cover entity.
          </p>
        </SectionCard>
      )}

      {/* ============================================================
          3. PRICING PAGE — quote pages
          ============================================================ */}
      <GroupHeading title="Pricing Page" hint="Line item table, totals, payment schedule" />

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <SectionCard
            title="Pricing Design"
            description="Pricing pages inherit body styling from Text Page below."
            icon={<DollarSign size={14} className="text-gray-400" />}
          >
            <p className="text-xs text-gray-400">
              Pricing pages share their background, body text and heading colour with text pages — set
              them in the Text Page section below. Line item column labels live on the Quote tab.
            </p>
          </SectionCard>
        </div>
        {type !== 'document' && (
          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
            <div className="sticky top-6">
              <PricingDesignPreview
                entityId={entityId}
                entityKey={type === 'template' ? 'template_id' : 'proposal_id'}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ============================================================
          4. PACKAGE PAGE
          ============================================================ */}
      <GroupHeading title="Package Page" hint="Gradient picker, feature icons, tier colours" />

      {type === 'document' ? (
        <SectionCard
          title="Packages Design"
          description="Documents don't have packages pages."
          icon={<Package size={14} className="text-gray-400" />}
        >
          <p className="text-xs text-gray-400">Not applicable to documents.</p>
        </SectionCard>
      ) : (
        <PackagesDesignPanel
          entityId={entityId}
          entityKey={type === 'template' ? 'template_id' : 'proposal_id'}
        />
      )}

      {/* ============================================================
          5. TEXT PAGE — body of every non-cover page
          ============================================================ */}
      <GroupHeading title="Text Page" hint="Also applies to pricing and packages bodies" />

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-5">
          <SectionCard
            title="Text Page Colours"
            description="Body background, body text, and heading colours for text pages."
            icon={<Palette size={14} className="text-gray-400" />}
            action={
              <button
                onClick={onTpResetToCompany}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal transition-colors"
              >
                <RotateCcw size={12} />
                Reset to company defaults
              </button>
            }
          >
            <div className="space-y-4">
              <ColorPickerField label="Background Color" value={tpBgColor} fallback={companyDefaults.bg_color} onChange={setTpBgColor} />
              <ColorPickerField label="Text Color" value={tpTextColor} fallback={companyDefaults.text_color} onChange={setTpTextColor} />
              <ColorPickerField label="Heading Color" value={tpHeadingColor} fallback={companyDefaults.heading_color || companyDefaults.text_color} onChange={setTpHeadingColor} />
            </div>
          </SectionCard>

          <SectionCard
            title="Page Number Badge"
            description="Leave blank to use your accent colour (circle) and white (text)."
            icon={<Hash size={14} className="text-gray-400" />}
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

        {type !== 'document' && (
          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
            <div className="sticky top-6">
              <TextPageDesignPreview
                entityId={entityId}
                entityKey={type === 'template' ? 'template_id' : 'proposal_id'}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
