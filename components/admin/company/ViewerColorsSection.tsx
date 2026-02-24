// components/admin/company/ViewerColorsSection.tsx
'use client';

import { ReactNode } from 'react';
import { Loader2, Palette } from 'lucide-react';
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
  children,
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