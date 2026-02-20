// components/admin/company/CoverColorsSection.tsx
'use client';

import { Loader2, Image as ImageIcon } from 'lucide-react';
import ColorRow from './ColorRow';

interface CoverColorsSectionProps {
  isOwner: boolean;
  saving: string | null;
  coverColorsChanged: boolean;
  onSave: () => void;
  coverBgStyle: 'gradient' | 'solid';
  setCoverBgStyle: (v: 'gradient' | 'solid') => void;
  coverGradientType: 'linear' | 'radial' | 'conic';
  setCoverGradientType: (v: 'linear' | 'radial' | 'conic') => void;
  coverGradientAngle: number;
  setCoverGradientAngle: (v: number) => void;
  coverBgColor1: string;
  setCoverBgColor1: (v: string) => void;
  coverBgColor2: string;
  setCoverBgColor2: (v: string) => void;
  coverOverlayOpacity: number;
  setCoverOverlayOpacity: (v: number) => void;
  coverTextColor: string;
  setCoverTextColor: (v: string) => void;
  coverSubtitleColor: string;
  setCoverSubtitleColor: (v: string) => void;
  coverButtonBg: string;
  setCoverButtonBg: (v: string) => void;
  coverButtonText: string;
  setCoverButtonText: (v: string) => void;
}

export default function CoverColorsSection({
  isOwner,
  saving,
  coverColorsChanged,
  onSave,
  coverBgStyle,
  setCoverBgStyle,
  coverGradientType,
  setCoverGradientType,
  coverGradientAngle,
  setCoverGradientAngle,
  coverBgColor1,
  setCoverBgColor1,
  coverBgColor2,
  setCoverBgColor2,
  coverOverlayOpacity,
  setCoverOverlayOpacity,
  coverTextColor,
  setCoverTextColor,
  coverSubtitleColor,
  setCoverSubtitleColor,
  coverButtonBg,
  setCoverButtonBg,
  coverButtonText,
  setCoverButtonText,
}: CoverColorsSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={15} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Cover Page Colors</span>
        </div>
        {isOwner && coverColorsChanged && (
          <button
            onClick={onSave}
            disabled={saving === 'coverColors'}
            className="px-4 py-1.5 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors"
          >
            {saving === 'coverColors' ? <Loader2 size={14} className="animate-spin" /> : 'Save Cover Colors'}
          </button>
        )}
      </div>

      {/* Background style toggle */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">Background Style</label>
        <div className="flex gap-2">
          <button
            onClick={() => isOwner && setCoverBgStyle('gradient')}
            disabled={!isOwner}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed ${
              coverBgStyle === 'gradient'
                ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded" style={{ background: coverGradientType === 'radial'
                ? `radial-gradient(circle, ${coverBgColor1}, ${coverBgColor2})`
                : coverGradientType === 'conic'
                ? `conic-gradient(from ${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`
                : `linear-gradient(${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})` }} />
              Gradient
            </div>
          </button>
          <button
            onClick={() => isOwner && setCoverBgStyle('solid')}
            disabled={!isOwner}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed ${
              coverBgStyle === 'solid'
                ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
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

      {/* Gradient Type — only when gradient style is selected */}
      {coverBgStyle === 'gradient' && (
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-2">Gradient Type</label>
          <div className="flex gap-2">
            {(['linear', 'radial', 'conic'] as const).map((type) => (
              <button
                key={type}
                onClick={() => isOwner && setCoverGradientType(type)}
                disabled={!isOwner}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed ${
                  coverGradientType === type
                    ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div
                    className="w-5 h-5 rounded"
                    style={{
                      background: type === 'linear'
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

      {/* Gradient Angle — for linear and conic only */}
      {coverBgStyle === 'gradient' && coverGradientType !== 'radial' && (
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-2">
            Gradient Angle — {coverGradientAngle}°
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="360"
              value={coverGradientAngle}
              onChange={(e) => isOwner && setCoverGradientAngle(parseInt(e.target.value))}
              disabled={!isOwner}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <input
              type="number"
              min="0"
              max="360"
              value={coverGradientAngle}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= 360) setCoverGradientAngle(v);
              }}
              disabled={!isOwner}
              className="w-16 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-900 font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex justify-between mt-1.5">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <button
                key={deg}
                onClick={() => isOwner && setCoverGradientAngle(deg)}
                disabled={!isOwner}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors disabled:cursor-not-allowed ${
                  coverGradientAngle === deg
                    ? 'text-[#017C87] bg-[#017C87]/10 font-medium'
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
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">Background Colors</label>
        <div className="space-y-2">
          <ColorRow
            label={coverBgStyle === 'gradient' ? 'Gradient start' : 'Background color'}
            value={coverBgColor1}
            onChange={setCoverBgColor1}
            disabled={!isOwner}
          />
          {coverBgStyle === 'gradient' && (
            <ColorRow
              label="Gradient end"
              value={coverBgColor2}
              onChange={setCoverBgColor2}
              disabled={!isOwner}
            />
          )}
        </div>
      </div>

      {/* Overlay opacity */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">
          Image Overlay Opacity — {Math.round(coverOverlayOpacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(coverOverlayOpacity * 100)}
          onChange={(e) => isOwner && setCoverOverlayOpacity(parseInt(e.target.value) / 100)}
          disabled={!isOwner}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 mt-1">Controls how much the background color shows over uploaded cover images.</p>
      </div>

      {/* Text colors */}
      <div className="mb-4 pt-4 border-t border-gray-100">
        <label className="block text-xs text-gray-400 mb-2">Text Colors</label>
        <div className="space-y-2">
          <ColorRow label="Title text" value={coverTextColor} onChange={setCoverTextColor} disabled={!isOwner} />
          <ColorRow label="Subtitle text" value={coverSubtitleColor} onChange={setCoverSubtitleColor} disabled={!isOwner} />
        </div>
      </div>

      {/* Button colors */}
      <div className="pt-4 border-t border-gray-100">
        <label className="block text-xs text-gray-400 mb-2">Button Colors</label>
        <div className="space-y-2">
          <ColorRow label="Button background" value={coverButtonBg} onChange={setCoverButtonBg} disabled={!isOwner} />
          <ColorRow label="Button text" value={coverButtonText} onChange={setCoverButtonText} disabled={!isOwner} />
        </div>
      </div>
    </div>
  );
}