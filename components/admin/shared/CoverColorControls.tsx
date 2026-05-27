// components/admin/shared/CoverColorControls.tsx
'use client';

import ColorPickerField from '@/components/ui/ColorPickerField';
import Slider from '@/components/ui/Slider';
import GradientStopsEditor from '@/components/ui/GradientStopsEditor';
import type { GradientStop } from '@/lib/gradient-stops';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CoverColorValues {
  coverBgStyle: 'gradient' | 'solid';
  coverGradientType: 'linear' | 'radial' | 'conic';
  coverGradientAngle: number;
  coverBgColor1: string;
  coverBgColor2: string;
  /** Multi-stop gradient. Defaults to two stops built from coverBgColor1/2. */
  coverGradientStops: GradientStop[];
  coverOverlayOpacity: number;
  coverTextColor: string;
  coverSubtitleColor: string;
  coverButtonBg: string;
  coverButtonTextColor: string;
}

export interface CoverColorControlsProps extends CoverColorValues {
  onChange: (values: Partial<CoverColorValues>) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CoverColorControls({
  coverBgStyle,
  coverGradientType,
  coverGradientAngle,
  coverBgColor1,
  coverBgColor2,
  coverGradientStops,
  coverOverlayOpacity,
  coverTextColor,
  coverSubtitleColor,
  coverButtonBg,
  coverButtonTextColor,
  onChange,
}: CoverColorControlsProps) {
  return (
    <div className="space-y-4">
      {/* Background style toggle */}
      <div>
        <label className="block text-xs text-faint mb-2">Background Style</label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ coverBgStyle: 'gradient' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              coverBgStyle === 'gradient'
                ? 'border-teal bg-teal/5 text-teal'
                : 'border-edge-strong text-dim hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-5 h-5 rounded"
                style={{
                  background:
                    coverGradientType === 'radial'
                      ? `radial-gradient(circle, ${coverBgColor1}, ${coverBgColor2})`
                      : coverGradientType === 'conic'
                      ? `conic-gradient(from ${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`
                      : `linear-gradient(${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`,
                }}
              />
              Gradient
            </div>
          </button>
          <button
            onClick={() => onChange({ coverBgStyle: 'solid' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              coverBgStyle === 'solid'
                ? 'border-teal bg-teal/5 text-teal'
                : 'border-edge-strong text-dim hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded" style={{ backgroundColor: coverBgColor1 }} />
              Solid
            </div>
          </button>
        </div>
      </div>

      {/* Gradient type — only when gradient is selected */}
      {coverBgStyle === 'gradient' && (
        <div>
          <label className="block text-xs text-faint mb-2">Gradient Type</label>
          <div className="flex gap-2">
            {(['linear', 'radial', 'conic'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onChange({ coverGradientType: type })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  coverGradientType === type
                    ? 'border-teal bg-teal/5 text-teal'
                    : 'border-edge-strong text-dim hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div
                    className="w-5 h-5 rounded"
                    style={{
                      background:
                        type === 'linear'
                          ? `linear-gradient(${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`
                          : type === 'radial'
                          ? `radial-gradient(circle, ${coverBgColor1}, ${coverBgColor2})`
                          : `conic-gradient(from ${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`,
                    }}
                  />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gradient angle — for linear and conic */}
      {coverBgStyle === 'gradient' && coverGradientType !== 'radial' && (
        <div>
          <label className="block text-xs text-faint mb-2">Angle — {coverGradientAngle}°</label>
          <div className="flex flex-wrap gap-1.5">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <button
                key={deg}
                onClick={() => onChange({ coverGradientAngle: deg })}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                  coverGradientAngle === deg
                    ? 'text-teal bg-teal/10 font-medium'
                    : 'text-faint hover:text-prose hover:bg-gray-100'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Background colors */}
      <div>
        <label className="block text-xs text-faint mb-2">Background Colors</label>
        {coverBgStyle === 'solid' ? (
          <ColorPickerField
            label="Background color"
            value={coverBgColor1}
            fallback="#0f0f0f"
            onChange={(v) => {
              const next: GradientStop[] = coverGradientStops.length
                ? coverGradientStops.map((s, i) => (i === 0 ? { ...s, color: v } : s))
                : [{ color: v, position: 0 }, { color: coverBgColor2, position: 100 }];
              onChange({ coverBgColor1: v, coverGradientStops: next });
            }}
          />
        ) : (
          <GradientStopsEditor
            stops={coverGradientStops}
            onChange={(next) => onChange({ coverGradientStops: next })}
            onCommit={(next) => onChange({
              coverGradientStops: next,
              coverBgColor1: next[0]?.color ?? coverBgColor1,
              coverBgColor2: next[next.length - 1]?.color ?? coverBgColor2,
            })}
          />
        )}
      </div>

      {/* Colour overlay opacity */}
      <Slider
        label="Colour overlay opacity"
        value={Math.round(coverOverlayOpacity * 100)}
        formatValue={(v) => `${v}%`}
        hint="How much the fill colour shows over the cover image. 0% = no tint."
        onChange={(pct) => onChange({ coverOverlayOpacity: pct / 100 })}
      />

      {/* Text colors */}
      <div className="pt-4 border-t border-edge">
        <label className="block text-xs text-faint mb-2">Text Colors</label>
        <div className="space-y-2">
          <ColorPickerField label="Title text" value={coverTextColor} fallback="#ffffff" onChange={(v) => onChange({ coverTextColor: v })} />
          <ColorPickerField label="Subtitle text" value={coverSubtitleColor} fallback="#ffffffb3" onChange={(v) => onChange({ coverSubtitleColor: v })} />
        </div>
      </div>

      {/* Button colors */}
      <div className="pt-4 border-t border-edge">
        <label className="block text-xs text-faint mb-2">Button Colors</label>
        <div className="space-y-2">
          <ColorPickerField label="Button background" value={coverButtonBg} fallback="#01434A" onChange={(v) => onChange({ coverButtonBg: v })} />
          <ColorPickerField label="Button text" value={coverButtonTextColor} fallback="#ffffff" onChange={(v) => onChange({ coverButtonTextColor: v })} />
        </div>
      </div>
    </div>
  );
}