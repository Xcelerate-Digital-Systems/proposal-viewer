// components/admin/company/ThemePresetsStrip.tsx
'use client';

import { Sliders } from 'lucide-react';
import { BG_PRESETS, ACCENT_PRESETS } from '@/lib/company-utils';

interface ThemePresetsStripProps {
  bgPrimary: string;
  setBgPrimary: (v: string) => void;
  bgSecondary: string;
  setBgSecondary: (v: string) => void;
  accentColor: string;
  setAccentColor: (v: string) => void;
  disabled: boolean;
}

export default function ThemePresetsStrip({
  bgPrimary,
  setBgPrimary,
  bgSecondary,
  setBgSecondary,
  accentColor,
  setAccentColor,
  disabled,
}: ThemePresetsStripProps) {
  const matchedBg = BG_PRESETS.find(
    (p) => p.primary.toLowerCase() === bgPrimary.toLowerCase() && p.secondary.toLowerCase() === bgSecondary.toLowerCase(),
  );
  const isCustomBg = !matchedBg;

  return (
    <div className="pb-4 mb-4 border-b border-edge">
      <span className="text-2xs font-semibold text-faint uppercase tracking-wider">Quick Start</span>

      {/* Background theme presets */}
      <div className="mt-2.5">
        <span className="text-2xs text-faint">Background theme</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {BG_PRESETS.map((preset) => {
            const active = preset === matchedBg;
            return (
              <button
                key={preset.label}
                onClick={() => { setBgPrimary(preset.primary); setBgSecondary(preset.secondary); }}
                disabled={disabled}
                className={`group flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                title={`${preset.label}: ${preset.primary} / ${preset.secondary}`}
              >
                <div
                  className={`flex w-[52px] h-7 rounded-lg overflow-hidden border-2 transition-all ${
                    active
                      ? 'border-teal ring-2 ring-teal/20'
                      : 'border-edge hover:border-edge-hover'
                  }`}
                >
                  <div className="w-1/2 h-full" style={{ backgroundColor: preset.primary }} />
                  <div className="w-1/2 h-full" style={{ backgroundColor: preset.secondary }} />
                </div>
                <span className={`text-2xs leading-none ${active ? 'text-teal font-medium' : 'text-faint'}`}>
                  {preset.label}
                </span>
              </button>
            );
          })}

          {/* Custom indicator */}
          <button
            disabled
            className="flex flex-col items-center gap-1 disabled:cursor-default"
          >
            <div
              className={`flex items-center justify-center w-[52px] h-7 rounded-lg border-2 transition-all ${
                isCustomBg
                  ? 'border-teal ring-2 ring-teal/20'
                  : 'border-dashed border-edge'
              }`}
              style={isCustomBg ? { background: `linear-gradient(90deg, ${bgPrimary}, ${bgSecondary})` } : undefined}
            >
              {!isCustomBg && <Sliders size={12} className="text-faint" />}
            </div>
            <span className={`text-2xs leading-none ${isCustomBg ? 'text-teal font-medium' : 'text-faint'}`}>
              Custom
            </span>
          </button>
        </div>
      </div>

      {/* Accent color presets */}
      <div className="mt-3">
        <span className="text-2xs text-faint">Accent colour</span>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {ACCENT_PRESETS.map((color) => {
            const active = color.toLowerCase() === accentColor.toLowerCase();
            return (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                disabled={disabled}
                className={`w-7 h-7 rounded-full border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? 'border-teal ring-2 ring-teal/20 scale-110'
                    : 'border-edge hover:border-edge-hover hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
