// components/admin/shared/CoverColorControls.tsx
'use client';

import ColorPickerField from '@/components/ui/ColorPickerField';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CoverColorValues {
  coverBgStyle: 'gradient' | 'solid';
  coverGradientType: 'linear' | 'radial' | 'conic';
  coverGradientAngle: number;
  coverBgColor1: string;
  coverBgColor2: string;
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
        <label className="block text-xs text-gray-400 mb-2">Background Style</label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ coverBgStyle: 'gradient' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              coverBgStyle === 'gradient'
                ? 'border-teal bg-teal/5 text-teal'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
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
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
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
          <label className="block text-xs text-gray-400 mb-2">Gradient Type</label>
          <div className="flex gap-2">
            {(['linear', 'radial', 'conic'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onChange({ coverGradientType: type })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  coverGradientType === type
                    ? 'border-teal bg-teal/5 text-teal'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
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
          <label className="block text-xs text-gray-400 mb-2">Angle — {coverGradientAngle}°</label>
          <div className="flex flex-wrap gap-1.5">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <button
                key={deg}
                onClick={() => onChange({ coverGradientAngle: deg })}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  coverGradientAngle === deg
                    ? 'text-teal bg-teal/10 font-medium'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
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
        <label className="block text-xs text-gray-400 mb-2">Background Colors</label>
        <div className="space-y-2">
          <ColorPickerField
              label={coverBgStyle === 'gradient' ? 'Gradient start' : 'Background color'}
              value={coverBgColor1}
              fallback="#0f0f0f"
              onChange={(v) => onChange({ coverBgColor1: v })}
            />
          {coverBgStyle === 'gradient' && (
            <ColorPickerField
              label="Gradient end"
              value={coverBgColor2}
              fallback="#141414"
              onChange={(v) => onChange({ coverBgColor2: v })}
            />
          )}
        </div>
      </div>

      {/* Overlay opacity */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">
          Image Overlay Opacity — {Math.round(coverOverlayOpacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(coverOverlayOpacity * 100)}
          onChange={(e) => onChange({ coverOverlayOpacity: parseInt(e.target.value) / 100 })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
        />
        <p className="text-xs text-gray-400 mt-1">
          Controls how much the background color shows over uploaded cover images.
        </p>
      </div>

      {/* Text colors */}
      <div className="pt-4 border-t border-gray-100">
        <label className="block text-xs text-gray-400 mb-2">Text Colors</label>
        <div className="space-y-2">
          <ColorPickerField label="Title text" value={coverTextColor} fallback="#ffffff" onChange={(v) => onChange({ coverTextColor: v })} />
          <ColorPickerField label="Subtitle text" value={coverSubtitleColor} fallback="#ffffffb3" onChange={(v) => onChange({ coverSubtitleColor: v })} />
        </div>
      </div>

      {/* Button colors */}
      <div className="pt-4 border-t border-gray-100">
        <label className="block text-xs text-gray-400 mb-2">Button Colors</label>
        <div className="space-y-2">
          <ColorPickerField label="Button background" value={coverButtonBg} fallback="#01434A" onChange={(v) => onChange({ coverButtonBg: v })} />
          <ColorPickerField label="Button text" value={coverButtonTextColor} fallback="#ffffff" onChange={(v) => onChange({ coverButtonTextColor: v })} />
        </div>
      </div>
    </div>
  );
}