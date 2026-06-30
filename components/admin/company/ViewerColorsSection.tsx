// components/admin/company/ViewerColorsSection.tsx
'use client';

import { ReactNode, useRef } from 'react';
import { Check, Loader2, Palette, Upload, Trash2, ImageIcon } from 'lucide-react';
import ColorPickerField from '@/components/ui/ColorPickerField';
import Slider from '@/components/ui/Slider';
import ThemePresetsStrip from './ThemePresetsStrip';
import { generateBrandPalette } from '@/lib/branding';

interface ViewerColorsSectionProps {
  isOwner: boolean;
  saving: string | null;
  colorsChanged: boolean;
  accentColor: string;
  setAccentColor: (v: string) => void;
  bgPrimary: string;
  setBgPrimary: (v: string) => void;
  bgSecondary: string;
  setBgSecondary: (v: string) => void;
  bgDivider: string | null;
  setBgDivider: (v: string | null) => void;
  sidebarTextColor: string;
  setSidebarTextColor: (v: string) => void;
  sidebarInactiveTextColor: string | null;
  setSidebarInactiveTextColor: (v: string | null) => void;
  acceptTextColor: string;
  setAcceptTextColor: (v: string) => void;
  lastSaved?: boolean;
  // ── Background image ──
  bgImageUrl: string | null;
  bgImageUploading: boolean;
  bgImageOverlayOpacity: number;
  setBgImageOverlayOpacity: (v: number) => void;
  onBgImageUpload: (file: File) => void;
  onBgImageRemove: () => void;
  children?: ReactNode;
}

export default function ViewerColorsSection({
  isOwner,
  saving,
  colorsChanged,
  accentColor,
  setAccentColor,
  bgPrimary,
  setBgPrimary,
  bgSecondary,
  setBgSecondary,
  bgDivider,
  setBgDivider,
  sidebarTextColor,
  setSidebarTextColor,
  sidebarInactiveTextColor,
  setSidebarInactiveTextColor,
  acceptTextColor,
  setAcceptTextColor,
  lastSaved,
  bgImageUrl,
  bgImageUploading,
  bgImageOverlayOpacity,
  setBgImageOverlayOpacity,
  onBgImageUpload,
  onBgImageRemove,
  children,
}: ViewerColorsSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-faint" />
          <span className="text-sm font-medium text-muted">Viewer Colours</span>
        </div>
        {isOwner && saving === 'colors' && (
          <span className="flex items-center gap-1.5 text-xs text-faint">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {isOwner && !colorsChanged && lastSaved && saving !== 'colors' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <p className="text-xs text-faint mb-4">Pick a theme to get started, then fine-tune. Changes save automatically.</p>

      {/* Theme presets — full width */}
      <ThemePresetsStrip
        bgPrimary={bgPrimary}
        setBgPrimary={setBgPrimary}
        bgSecondary={bgSecondary}
        setBgSecondary={setBgSecondary}
        disabled={!isOwner}
      />

      {/* Controls + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Color controls */}
        <div>
          {/* Accent color */}
          <div className="mb-4">
            <span className="text-xs font-medium text-dim">Accent Colour</span>
            <div className="mt-1.5">
              <ColorPickerField label="Buttons, links, highlights" value={accentColor} fallback="#01434A" onChange={setAccentColor} disabled={!isOwner} />
            </div>
          </div>

          {/* Background */}
          <div className="mb-4 pt-4 border-t border-edge">
            <span className="text-xs font-medium text-dim">Background</span>
            <div className="space-y-2 mt-1.5">
              <ColorPickerField label="Main background" value={bgPrimary} fallback="#0f0f0f" onChange={setBgPrimary} disabled={!isOwner} />
              <ColorPickerField
                label="Dividers"
                value={bgDivider}
                fallback={generateBrandPalette(accentColor, bgPrimary, bgSecondary).border}
                onChange={(v) => setBgDivider(v || null)}
                onReset={() => setBgDivider(null)}
                disabled={!isOwner}
              />
              <ColorPickerField label="Panels & headers" value={bgSecondary} fallback="#141414" onChange={setBgSecondary} disabled={!isOwner} />
            </div>
          </div>

          {/* Background texture */}
          <div className="mb-4 pt-4 border-t border-edge">
            <span className="text-xs font-medium text-dim">Background Texture</span>
            <p className="text-xs text-faint mt-1 mb-3">
              Optional image or pattern behind viewer pages. PNG, JPEG, WebP, or SVG. Max 5 MB.
            </p>

            {bgImageUrl ? (
              <div className="flex items-start gap-3">
                <div
                  className="w-20 h-14 rounded-lg border border-edge bg-cover bg-center shrink-0"
                  style={{ backgroundImage: `url(${bgImageUrl})` }}
                />
                <div className="space-y-1.5">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={bgImageUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted bg-surface border border-edge rounded-lg hover:bg-edge disabled:opacity-50 transition-colors"
                      >
                        {bgImageUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Replace
                      </button>
                      <button
                        onClick={onBgImageRemove}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              isOwner && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={bgImageUploading}
                  className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-edge text-faint hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
                >
                  {bgImageUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  <span className="text-xs font-medium">Upload background image</span>
                </button>
              )
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onBgImageUpload(file);
                e.target.value = '';
              }}
            />

            {bgImageUrl && (
              <div className="mt-3">
                <Slider
                  label="Colour overlay opacity"
                  value={Math.round(bgImageOverlayOpacity * 100)}
                  formatValue={(v) => `${v}%`}
                  hint="How much the main background colour tints the image. 0% = no tint."
                  disabled={!isOwner}
                  onChange={(pct) => setBgImageOverlayOpacity(pct / 100)}
                />
              </div>
            )}
          </div>

          {/* Text on dark surfaces */}
          <div className="pt-4 border-t border-edge">
            <span className="text-xs font-medium text-dim">Text on Dark Surfaces</span>
            <div className="space-y-2 mt-1.5">
              <ColorPickerField label="Light text" value={sidebarTextColor} fallback="#ffffff" onChange={setSidebarTextColor} disabled={!isOwner} />
              <ColorPickerField
                label="Inactive text"
                value={sidebarInactiveTextColor}
                fallback={generateBrandPalette(accentColor, bgPrimary, bgSecondary, sidebarTextColor).mutedText}
                onChange={(v) => setSidebarInactiveTextColor(v || null)}
                onReset={() => setSidebarInactiveTextColor(null)}
                disabled={!isOwner}
              />
              <ColorPickerField label="Button text" value={acceptTextColor} fallback="#ffffff" onChange={setAcceptTextColor} disabled={!isOwner} />
            </div>
          </div>
        </div>

        {/* Right: Live preview */}
        {children && (
          <div>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
