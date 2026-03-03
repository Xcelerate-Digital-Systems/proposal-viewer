// components/admin/company/ViewerColorsSection.tsx
'use client';

import { ReactNode, useRef, useState } from 'react';
import { Loader2, Palette, Upload, Trash2, ImageIcon } from 'lucide-react';
import ColorRow from './ColorRow';

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
  sidebarTextColor: string;
  setSidebarTextColor: (v: string) => void;
  acceptTextColor: string;
  setAcceptTextColor: (v: string) => void;
  onSave: () => void;
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
  sidebarTextColor,
  setSidebarTextColor,
  acceptTextColor,
  setAcceptTextColor,
  onSave,
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Viewer Colors</span>
        </div>
        {isOwner && colorsChanged && (
          <button
            onClick={onSave}
            disabled={saving === 'colors' || !/^#[0-9a-fA-F]{6}$/.test(accentColor) || !/^#[0-9a-fA-F]{6}$/.test(bgPrimary) || !/^#[0-9a-fA-F]{6}$/.test(bgSecondary) || !/^#[0-9a-fA-F]{6}$/.test(sidebarTextColor) || !/^#[0-9a-fA-F]{6}$/.test(acceptTextColor)}
            className="px-4 py-1.5 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors"
          >
            {saving === 'colors' ? <Loader2 size={14} className="animate-spin" /> : 'Save Colors'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Color controls */}
        <div>
          {/* Accent color */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2">Accent Color</label>
            <ColorRow label="Buttons, links, highlights" value={accentColor} onChange={setAccentColor} disabled={!isOwner} />
          </div>

          {/* Background colors */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2">Background Colors</label>
            <div className="space-y-2">
              <ColorRow label="Main background" value={bgPrimary} onChange={setBgPrimary} disabled={!isOwner} />
              <ColorRow label="Sidebar / panels" value={bgSecondary} onChange={setBgSecondary} disabled={!isOwner} />
            </div>
          </div>

          {/* Background image */}
          <div className="mb-4 pt-4 border-t border-gray-100">
            <label className="block text-xs text-gray-400 mb-2">Background Image (optional)</label>
            <p className="text-xs text-gray-400 mb-3">
              Upload a texture or pattern to display behind PDF pages. The main background color is overlaid on top.
            </p>

            {bgImageUrl ? (
              <div className="flex items-start gap-3">
                <div
                  className="w-20 h-14 rounded-lg border border-gray-200 bg-cover bg-center shrink-0"
                  style={{ backgroundImage: `url(${bgImageUrl})` }}
                />
                <div className="space-y-1.5">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={bgImageUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#017C87]/40 hover:text-[#017C87] transition-colors disabled:opacity-50"
                >
                  {bgImageUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  <span className="text-xs font-medium">Upload background image</span>
                </button>
              )
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onBgImageUpload(file);
                e.target.value = '';
              }}
            />

            {/* Overlay opacity — only show when image is set */}
            {bgImageUrl && (
              <div className="mt-3">
                <label className="block text-xs text-gray-400 mb-1">
                  Color Overlay Opacity — {Math.round(bgImageOverlayOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(bgImageOverlayOpacity * 100)}
                  onChange={(e) => setBgImageOverlayOpacity(parseInt(e.target.value) / 100)}
                  disabled={!isOwner}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87] disabled:cursor-not-allowed"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Controls how much the main background color shows over the image. Higher = more color, less image.
                </p>
              </div>
            )}
          </div>

          {/* Text colors */}
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-xs text-gray-400 mb-2">Text Colors</label>
            <div className="space-y-2">
              <ColorRow label="Sidebar nav text" value={sidebarTextColor} onChange={setSidebarTextColor} disabled={!isOwner} />
              <ColorRow label="Accept button text" value={acceptTextColor} onChange={setAcceptTextColor} disabled={!isOwner} />
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