// components/admin/company/ViewerColorsSection.tsx
'use client';

import { Loader2, Palette } from 'lucide-react';
import ColorRow from './ColorRow';
import { deriveBorder, ACCENT_PRESETS, BG_PRESETS } from '@/lib/company-utils';

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
}: ViewerColorsSectionProps) {
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

      {/* Accent color */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">Accent Color</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => isOwner && setAccentColor(color)}
              disabled={!isOwner}
              className={`w-7 h-7 rounded-lg border-2 transition-all ${
                accentColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-300'
              } disabled:cursor-not-allowed`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <ColorRow label="Buttons, links, highlights" value={accentColor} onChange={setAccentColor} disabled={!isOwner} />
      </div>

      {/* Background presets */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">Background Theme</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                if (!isOwner) return;
                setBgPrimary(preset.primary);
                setBgSecondary(preset.secondary);
              }}
              disabled={!isOwner}
              className={`rounded-lg border-2 p-2 text-center transition-all disabled:cursor-not-allowed ${
                bgPrimary === preset.primary && bgSecondary === preset.secondary
                  ? 'border-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ backgroundColor: preset.primary }}
            >
              <div className="flex gap-1 justify-center mb-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary, border: `1px solid ${deriveBorder(preset.secondary)}` }} />
                <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.secondary, border: `1px solid ${deriveBorder(preset.secondary)}` }} />
              </div>
              <span className="text-[10px] text-[#888]">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom bg inputs */}
      <div className="space-y-2">
        <ColorRow label="Main background" value={bgPrimary} onChange={setBgPrimary} disabled={!isOwner} />
        <ColorRow label="Sidebar / panels" value={bgSecondary} onChange={setBgSecondary} disabled={!isOwner} />
      </div>

      {/* Text colors */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <label className="block text-xs text-gray-400 mb-2">Text Colors</label>
        <div className="space-y-2">
          <ColorRow label="Sidebar nav text" value={sidebarTextColor} onChange={setSidebarTextColor} disabled={!isOwner} />
          <ColorRow label="Accept button text" value={acceptTextColor} onChange={setAcceptTextColor} disabled={!isOwner} />
        </div>
      </div>
    </div>
  );
}