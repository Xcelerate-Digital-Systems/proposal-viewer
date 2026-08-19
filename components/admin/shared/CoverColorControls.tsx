// components/admin/shared/CoverColorControls.tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
/*  Collapsible sub-section                                            */
/* ------------------------------------------------------------------ */

function ColorGroup({
  title,
  defaultOpen = true,
  preview,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-edge bg-white/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-ink">{title}</span>
          {!open && preview}
        </div>
        <ChevronDown
          size={14}
          className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Paired swatch row                                                  */
/* ------------------------------------------------------------------ */

function PairedSwatches({
  items,
}: {
  items: { label: string; value: string; fallback: string; onChange: (v: string) => void }[];
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ColorPickerField
          key={item.label}
          label={item.label}
          value={item.value}
          fallback={item.fallback}
          onChange={item.onChange}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildGradientCss(
  type: 'linear' | 'radial' | 'conic',
  angle: number,
  stops: GradientStop[],
  color1: string,
  color2: string,
): string {
  const stopList = stops.length >= 2
    ? stops.map((s) => `${s.color} ${s.position}%`).join(', ')
    : `${color1}, ${color2}`;

  if (type === 'radial') return `radial-gradient(circle, ${stopList})`;
  if (type === 'conic') return `conic-gradient(from ${angle}deg, ${stopList})`;
  return `linear-gradient(${angle}deg, ${stopList})`;
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
  const gradientCss = buildGradientCss(
    coverGradientType,
    coverGradientAngle,
    coverGradientStops,
    coverBgColor1,
    coverBgColor2,
  );

  const bgPreview = (
    <div
      className="w-16 h-5 rounded-md border border-edge-strong shrink-0"
      style={{
        background: coverBgStyle === 'solid' ? coverBgColor1 : gradientCss,
      }}
    />
  );

  const textPreview = (
    <div className="flex gap-1 shrink-0">
      <div className="w-5 h-5 rounded-md border border-edge-strong" style={{ backgroundColor: coverTextColor }} />
      <div className="w-5 h-5 rounded-md border border-edge-strong" style={{ backgroundColor: coverSubtitleColor }} />
    </div>
  );

  const buttonPreview = (
    <div className="flex gap-1 shrink-0">
      <div className="w-5 h-5 rounded-md border border-edge-strong" style={{ backgroundColor: coverButtonBg }} />
      <div className="w-5 h-5 rounded-md border border-edge-strong" style={{ backgroundColor: coverButtonTextColor }} />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── Background ─────────────────────────────────── */}
      <ColorGroup title="Background" preview={bgPreview}>
        {/* Live preview strip */}
        <div
          className="w-full h-10 rounded-lg border border-edge-strong"
          style={{
            background: coverBgStyle === 'solid' ? coverBgColor1 : gradientCss,
          }}
        />

        {/* Style toggle */}
        <div className="flex gap-2">
          {(['gradient', 'solid'] as const).map((style) => (
            <button
              key={style}
              onClick={() => onChange({ coverBgStyle: style })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                coverBgStyle === style
                  ? 'border-teal bg-teal/5 text-teal'
                  : 'border-edge-strong text-dim hover:border-edge-hover'
              }`}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>

        {/* Gradient-specific controls */}
        {coverBgStyle === 'gradient' && (
          <>
            {/* Gradient type */}
            <div>
              <label className="block text-xs text-dim mb-1.5">Type</label>
              <div className="flex gap-1.5">
                {(['linear', 'radial', 'conic'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => onChange({ coverGradientType: type })}
                    className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      coverGradientType === type
                        ? 'bg-teal/10 text-teal'
                        : 'text-dim hover:bg-surface'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Angle — linear & conic only */}
            {coverGradientType !== 'radial' && (
              <div>
                <label className="block text-xs text-dim mb-1.5">Angle — {coverGradientAngle}°</label>
                <div className="flex flex-wrap gap-1">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => onChange({ coverGradientAngle: deg })}
                      className={`px-2 py-1 rounded-md text-xs transition-all ${
                        coverGradientAngle === deg
                          ? 'text-teal bg-teal/10 font-medium'
                          : 'text-faint hover:text-prose hover:bg-surface'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Gradient stops */}
            <GradientStopsEditor
              stops={coverGradientStops}
              onChange={(next) => onChange({ coverGradientStops: next })}
              onCommit={(next) => onChange({
                coverGradientStops: next,
                coverBgColor1: next[0]?.color ?? coverBgColor1,
                coverBgColor2: next[next.length - 1]?.color ?? coverBgColor2,
              })}
            />
          </>
        )}

        {/* Solid color */}
        {coverBgStyle === 'solid' && (
          <ColorPickerField
            label="Color"
            value={coverBgColor1}
            fallback="#0f0f0f"
            onChange={(v) => {
              const next: GradientStop[] = coverGradientStops.length
                ? coverGradientStops.map((s, i) => (i === 0 ? { ...s, color: v } : s))
                : [{ color: v, position: 0 }, { color: coverBgColor2, position: 100 }];
              onChange({ coverBgColor1: v, coverGradientStops: next });
            }}
          />
        )}

        {/* Overlay opacity */}
        <Slider
          label="Colour overlay"
          value={Math.round(coverOverlayOpacity * 100)}
          formatValue={(v) => `${v}%`}
          hint="How much the fill shows over a background image."
          onChange={(pct) => onChange({ coverOverlayOpacity: pct / 100 })}
        />
      </ColorGroup>

      {/* ── Text Colors ────────────────────────────────── */}
      <ColorGroup title="Text" defaultOpen={false} preview={textPreview}>
        <PairedSwatches
          items={[
            { label: 'Title', value: coverTextColor, fallback: '#ffffff', onChange: (v) => onChange({ coverTextColor: v }) },
            { label: 'Subtitle', value: coverSubtitleColor, fallback: '#ffffffb3', onChange: (v) => onChange({ coverSubtitleColor: v }) },
          ]}
        />
      </ColorGroup>

      {/* ── Button Colors ──────────────────────────────── */}
      <ColorGroup title="Button" defaultOpen={false} preview={buttonPreview}>
        <PairedSwatches
          items={[
            { label: 'Background', value: coverButtonBg, fallback: '#01434A', onChange: (v) => onChange({ coverButtonBg: v }) },
            { label: 'Text', value: coverButtonTextColor, fallback: '#ffffff', onChange: (v) => onChange({ coverButtonTextColor: v }) },
          ]}
        />
      </ColorGroup>
    </div>
  );
}
