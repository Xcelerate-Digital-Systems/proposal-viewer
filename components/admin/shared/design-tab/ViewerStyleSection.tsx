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
import FontSelect from '@/components/admin/shared/FontSelect';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import CoverDesignPanel from '@/components/admin/builder-sections/CoverDesignPanel';
import PackagesDesignPanel from '@/components/admin/builder-sections/PackagesDesignPanel';
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
    <div className="pt-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      <div className="mt-1.5 h-px bg-gray-100" />
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

  return (
    <div className="space-y-5">
      {/* ============================================================
          1. GLOBALS
          ============================================================ */}
      <GroupHeading title="Globals" hint="Apply across every page" />

      <SectionCard
        title="Page Orientation"
        description={`Controls the orientation of text pages, pricing, and packages when this ${type} exports as PDF.`}
        icon={<LayoutPanelTop size={14} className="text-gray-400" />}
      >
        <div className="flex gap-2">
          {orientationOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPageOrientation(opt.key)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors ${
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
      </SectionCard>

      <SectionCard
        title="Background Image"
        description="Sits behind text pages, pricing, and packages."
        icon={<ImageIcon size={14} className="text-gray-400" />}
      >
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

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Color Overlay — {Math.round(overlayOpacity * 100)}%
                </label>
                <input
                  type="range" min="0" max="100"
                  value={Math.round(overlayOpacity * 100)}
                  onChange={(e) => setOverlayOpacity(parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Blur — {bgImageBlur > 0 ? `${bgImageBlur}px` : 'Off'}
                </label>
                <input
                  type="range" min="0" max="20"
                  value={bgImageBlur}
                  onChange={(e) => setBgImageBlur(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
                />
              </div>

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
          3. TEXT PAGE
          ============================================================ */}
      <GroupHeading title="Text Page" />

      <SectionCard
        title="Page Title Font"
        description="Headline typography for text pages, pricing, and packages."
        icon={<Type size={14} className="text-gray-400" />}
      >
        <div className="space-y-3">
          <FontSelect
            label="Title Font"
            description="Leave blank to use your company heading font"
            value={titleFontFamily}
            onChange={setTitleFontFamily}
            previewText="Your Page Title"
            weight={titleFontWeight}
            onWeightChange={setTitleFontWeight}
          />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title Size</label>
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
        </div>
      </SectionCard>

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

      {/* ============================================================
          4. PACKAGES PAGE
          ============================================================ */}
      <GroupHeading title="Packages Page" hint="Gradient picker, feature icons, tier colours" />

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
          5. QUOTE PAGES
          ============================================================ */}
      <GroupHeading title="Quote Pages" hint="Line item table, totals, payment schedule" />

      <SectionCard
        title="Quote Design"
        description="Quote pages inherit from Text Page styling above."
        icon={<DollarSign size={14} className="text-gray-400" />}
      >
        <p className="text-xs text-gray-400">
          Quote pages share their colours and fonts with text pages — the page background, body
          text and heading colour are controlled by the Text Page section above. Line item column
          labels are still managed on the Quote tab.
        </p>
      </SectionCard>
    </div>
  );
}
