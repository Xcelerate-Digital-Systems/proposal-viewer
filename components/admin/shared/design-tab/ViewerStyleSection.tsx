// components/admin/shared/design-tab/ViewerStyleSection.tsx
'use client';

import { useRef, useState } from 'react';
import {
  Check, Loader2, Upload, Trash2,
  Image as ImageIcon, RotateCcw, Type, Palette,
} from 'lucide-react';
import ViewerStylePreview, { ViewerStylePreviewTabs } from './ViewerStylePreview';
import type { TabKey } from './ViewerStylePreview';
import FontSelect from '@/components/admin/shared/FontSelect';
import ColorRow from './ColorRow';
import {
  EntityType, PageOrientation, TextPageDefaults,
  orientationOptions, SaveStatus,
} from './DesignTabTypes';

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
  /* ── Defaults & actions ─────────────────────────────────── */
  companyDefaults: TextPageDefaults;
  onTpResetToCompany: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ViewerStyleSection({
  type,
  saveStatus,
  pageOrientation,
  setPageOrientation,
  bgMode,
  setBgMode,
  bgImageUrl,
  uploading,
  overlayOpacity,
  setOverlayOpacity,
  companyBgPrimary,
  previewImageUrl,
  previewOpacity,
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
  companyDefaults,
  onTpResetToCompany,
}: ViewerStyleSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewTab, setPreviewTab] = useState<TabKey>('text');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Viewer Style</h4>
        </div>
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        {/* ══════════════════════════════════════════════════════ */}
        {/*  Left: Controls                                       */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="space-y-5">
          <p className="text-xs text-gray-400">
            Styling for this {type}&apos;s viewer. Changes save automatically.
          </p>

          {/* ── Page Orientation ─────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Page Orientation</label>
            <p className="text-[10px] text-gray-400 mb-3">
              Controls the orientation of text pages, pricing, and packages when exported as PDF.
            </p>
            <div className="flex gap-2">
              {orientationOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPageOrientation(opt.key)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors ${
                    pageOrientation === opt.key
                      ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className={pageOrientation === opt.key ? 'text-[#017C87]' : 'text-gray-400'}>
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* ── Background Image ─────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-3">Background Image</label>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setBgMode('company')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  bgMode === 'company'
                    ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Company Default
              </button>
              <button
                onClick={() => setBgMode('custom')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  bgMode === 'custom'
                    ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Custom Override
              </button>
            </div>

            {bgMode === 'custom' && (
              <>
                {bgImageUrl ? (
                  <div className="mb-3">
                    <div className="relative w-full h-20 rounded-lg overflow-hidden border border-gray-200">
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${bgImageUrl})` }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: companyBgPrimary, opacity: overlayOpacity }}
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                    className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#017C87]/40 hover:text-[#017C87] transition-colors disabled:opacity-50 bg-white"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    <span className="text-xs font-medium">Upload background image</span>
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = '';
                  }}
                />

                {/* Overlay opacity */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Color Overlay — {Math.round(overlayOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) => setOverlayOpacity(parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87]"
                  />
                </div>

                <button
                  onClick={onBgResetToCompany}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#017C87] transition-colors mt-1"
                >
                  <RotateCcw size={12} />
                  Reset to company default
                </button>
              </>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* ── Page Title Font ───────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Type size={12} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Page Title Font</span>
            </div>
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#017C87]/30"
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

          <div className="border-t border-gray-100" />

          {/* ── Text Page Colors ──────────────────────────────── */}
          <div className="space-y-4">
            <ColorRow label="Background Color" value={tpBgColor} onChange={setTpBgColor} />
            <ColorRow label="Text Color" value={tpTextColor} onChange={setTpTextColor} />
            <ColorRow label="Heading Color" value={tpHeadingColor} onChange={setTpHeadingColor} />

            <button
              onClick={onTpResetToCompany}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#017C87] transition-colors"
            >
              <RotateCcw size={12} />
              Reset colours to company defaults
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  Right: Unified preview                               */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="lg:sticky lg:top-40">
          {/* Tab bar — above the preview container */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">Preview</p>
            <ViewerStylePreviewTabs activeTab={previewTab} onTabChange={setPreviewTab} />
          </div>

          <div
            className="relative rounded-xl overflow-hidden border border-gray-200 shadow-2xl shadow-black/40"
            style={{ backgroundColor: companyBgPrimary }}
          >
            {/* Background image layer */}
            {previewImageUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${previewImageUrl})` }}
              />
            )}
            {/* Overlay layer */}
            {previewImageUrl && (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: companyBgPrimary, opacity: previewOpacity }}
              />
            )}

            {/* Page preview content */}
            <div className="relative">
              <ViewerStylePreview
                activeTab={previewTab}
                tpBgColor={previewImageUrl ? 'transparent' : (tpBgColor || '#141414')}
                tpTextColor={tpTextColor || '#ffffff'}
                tpHeadingColor={tpHeadingColor}
                fontSize={companyDefaults.font_size || '14'}
                accent={companyDefaults.accent_color}
                bgPrimary={previewImageUrl ? 'transparent' : companyBgPrimary}
                bgSecondary={companyDefaults.bg_secondary}
                sidebarTextColor={companyDefaults.sidebar_text_color}
                coverTextColor={companyDefaults.cover_text_color}
                coverSubtitleColor={companyDefaults.cover_subtitle_color}
                titleFontFamily={titleFontFamily}
                titleFontWeight={titleFontWeight}
                titleFontSize={titleFontSize}
                fontHeading={companyDefaults.font_heading}
                fontBody={companyDefaults.font_body}
              />
            </div>

            {/* Mode badge */}
            <div className="absolute bottom-2 right-2 z-10">
              <span className="text-[9px] text-white/30 bg-black/20 px-1.5 py-0.5 rounded">
                {bgMode === 'company' ? 'Company BG' : 'Custom BG'}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Switch tabs to see how each page type is affected by your styling.
          </p>
        </div>
      </div>
    </div>
  );
}