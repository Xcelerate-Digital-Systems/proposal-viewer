// components/admin/shared/design-tab/ViewerStyleSection.tsx
'use client';

import { useRef } from 'react';
import {
  Loader2, Upload, Trash2,
  Image as ImageIcon, RotateCcw, Type, Palette, Hash,
} from 'lucide-react';
import FontSelect from '@/components/admin/shared/FontSelect';
import ColorPickerField from '@/components/ui/ColorPickerField';
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
  bgImageBlur,
  setBgImageBlur,
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
  pageNumCircleColor,
  setPageNumCircleColor,
  pageNumTextColor,
  setPageNumTextColor,
  companyDefaults,
  onTpResetToCompany,
}: ViewerStyleSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Viewer Style</h4>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-5">
        Styling for this {type}&apos;s viewer. Changes save automatically.
      </p>

      <div className="grid grid-cols-2 gap-8">

        {/* ── LEFT: Orientation + Background + Font ─────────── */}
        <div className="space-y-5">

          {/* Page Orientation */}
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

          <div className="border-t border-gray-100" />

          {/* Background Image */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500">Background Image</label>
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

        </div>

        {/* ── RIGHT: Font + Colors ──────────────────────────── */}
        <div className="space-y-5">

          {/* Page Title Font */}
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

          <div className="border-t border-gray-100" />

          {/* Text Page Colors */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <Palette size={12} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Text Page Colours</span>
            </div>
            <ColorPickerField label="Background Color" value={tpBgColor} fallback={companyDefaults.bg_color} onChange={setTpBgColor} />
            <ColorPickerField label="Text Color" value={tpTextColor} fallback={companyDefaults.text_color} onChange={setTpTextColor} />
            <ColorPickerField label="Heading Color" value={tpHeadingColor} fallback={companyDefaults.heading_color || companyDefaults.text_color} onChange={setTpHeadingColor} />
            <button
              onClick={onTpResetToCompany}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal transition-colors"
            >
              <RotateCcw size={12} />
              Reset colours to company defaults
            </button>
          </div>

          <div className="border-t border-gray-100" />

          {/* Page Number Badge */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Hash size={12} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Page Number Badge</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Leave blank to use your accent colour (circle) and white (text).
            </p>
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

        </div>

      </div>
    </div>
  );
}