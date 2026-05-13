// components/admin/quotes/HeaderStyleCard.tsx
// Cover-tab card for editing the header fill: solid / linear / radial /
// conic, colours, angle, position. The large preview band is interactive —
// for radial and conic gradients, click anywhere on it (or drag) to set the
// gradient's centre. Live and rendered exactly how the public quote header
// will look. Quote body colours live in the Settings tab; this is just for
// the cover band.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import ColorPickerField, { setBrandingColors } from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

// Column-prefix config so the same card can edit either the cover splash
// (cover_*) or the quote-body header band (quote_header_*). Each path also
// reads its own preferred default; quote_header_* falls back to cover_* so
// existing quotes don't suddenly lose their styling.
export type HeaderStyleVariant = 'cover' | 'quote-header';

interface Props {
  proposal: Proposal;
  companyId: string;
  onSaved: () => void;
  variant?: HeaderStyleVariant;
  title?: string;
  description?: string;
}

interface VariantCols {
  bg_style: keyof Proposal;
  bg_color_1: keyof Proposal;
  bg_color_2: keyof Proposal;
  gradient_type: keyof Proposal;
  gradient_angle: keyof Proposal;
  position_x: keyof Proposal;
  position_y: keyof Proposal;
  text_color: keyof Proposal;
  subtitle_color: keyof Proposal;
  /** Overlay opacity only applies to cover (sits behind cover image). */
  overlay_opacity?: keyof Proposal;
}

const COVER_COLS: VariantCols = {
  bg_style: 'cover_bg_style',
  bg_color_1: 'cover_bg_color_1',
  bg_color_2: 'cover_bg_color_2',
  gradient_type: 'cover_gradient_type',
  gradient_angle: 'cover_gradient_angle',
  position_x: 'cover_gradient_position_x',
  position_y: 'cover_gradient_position_y',
  text_color: 'cover_text_color',
  subtitle_color: 'cover_subtitle_color',
  overlay_opacity: 'cover_overlay_opacity',
};

const QUOTE_HEADER_COLS: VariantCols = {
  bg_style: 'quote_header_bg_style',
  bg_color_1: 'quote_header_bg_color_1',
  bg_color_2: 'quote_header_bg_color_2',
  gradient_type: 'quote_header_gradient_type',
  gradient_angle: 'quote_header_gradient_angle',
  position_x: 'quote_header_gradient_position_x',
  position_y: 'quote_header_gradient_position_y',
  text_color: 'quote_header_text_color',
  subtitle_color: 'quote_header_subtitle_color',
};

const HEADER_FALLBACK_1 = '#0f0f0f';
const HEADER_FALLBACK_2 = '#1e293b';

type BgStyle = 'gradient' | 'solid';
type GradientType = 'linear' | 'radial' | 'conic';
type StyleMode = 'solid' | GradientType;

function gradientFor(
  style: BgStyle,
  type: GradientType,
  angle: number,
  cx: number,
  cy: number,
  c1: string,
  c2: string,
): string {
  if (style === 'solid') return c1;
  if (type === 'radial') return `radial-gradient(circle at ${cx}% ${cy}%, ${c1}, ${c2})`;
  if (type === 'conic')  return `conic-gradient(from ${angle}deg at ${cx}% ${cy}%, ${c1}, ${c2})`;
  return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
}

export default function HeaderStyleCard({
  proposal,
  companyId,
  onSaved,
  variant = 'cover',
  title,
  description,
}: Props) {
  const toast = useToast();
  const cols = variant === 'cover' ? COVER_COLS : QUOTE_HEADER_COLS;

  // For quote-header, fall back to cover_* when the quote-header column is
  // null — that way existing quotes inherit their old styling until the user
  // explicitly diverges them.
  const read = <T,>(key: keyof Proposal, fallbackKey?: keyof Proposal): T | null => {
    const primary = (proposal as Record<string, unknown>)[key as string];
    if (primary !== null && primary !== undefined) return primary as T;
    if (fallbackKey) {
      const fb = (proposal as Record<string, unknown>)[fallbackKey as string];
      if (fb !== null && fb !== undefined) return fb as T;
    }
    return null;
  };

  const fbBgStyle  = variant === 'quote-header' ? 'cover_bg_style'        : undefined;
  const fbColor1   = variant === 'quote-header' ? 'cover_bg_color_1'      : undefined;
  const fbColor2   = variant === 'quote-header' ? 'cover_bg_color_2'      : undefined;
  const fbGradType = variant === 'quote-header' ? 'cover_gradient_type'   : undefined;
  const fbGradAng  = variant === 'quote-header' ? 'cover_gradient_angle'  : undefined;
  const fbPosX     = variant === 'quote-header' ? 'cover_gradient_position_x' : undefined;
  const fbPosY     = variant === 'quote-header' ? 'cover_gradient_position_y' : undefined;
  const fbText     = variant === 'quote-header' ? 'cover_text_color'      : undefined;
  const fbSubtitle = variant === 'quote-header' ? 'cover_subtitle_color'  : undefined;

  // Push company brand palette into the colour picker on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('brand_colors')
        .eq('id', companyId)
        .single();
      if (cancelled) return;
      const palette = Array.isArray(data?.brand_colors) ? (data!.brand_colors as string[]) : [];
      setBrandingColors(palette);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const [bgStyle, setBgStyle]             = useState<BgStyle>((read<string>(cols.bg_style, fbBgStyle) as BgStyle) || 'gradient');
  const [gradientType, setGradientType]   = useState<GradientType>((read<string>(cols.gradient_type, fbGradType) as GradientType) || 'linear');
  const [gradientAngle, setGradientAngle] = useState<number>(read<number>(cols.gradient_angle, fbGradAng) ?? 135);
  const [cx, setCx]                       = useState<number>(read<number>(cols.position_x, fbPosX) ?? 50);
  const [cy, setCy]                       = useState<number>(read<number>(cols.position_y, fbPosY) ?? 50);
  const [bgColor1, setBgColor1]           = useState(read<string>(cols.bg_color_1, fbColor1) ?? HEADER_FALLBACK_1);
  const [bgColor2, setBgColor2]           = useState(read<string>(cols.bg_color_2, fbColor2) ?? HEADER_FALLBACK_2);
  const [coverTextColor, setCoverTextColor]         = useState(read<string>(cols.text_color, fbText) ?? '#ffffff');
  const [coverSubtitleColor, setCoverSubtitleColor] = useState(read<string>(cols.subtitle_color, fbSubtitle) ?? '#ffffffb3');
  const [overlayOpacity, setOverlayOpacity]         = useState<number>(
    cols.overlay_opacity ? Number(read<number>(cols.overlay_opacity) ?? 0.65) : 0.65,
  );

  const persist = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('proposals').update(patch).eq('id', proposal.id);
    if (error) { toast.error('Failed to save'); return; }
    onSaved();
  };

  const currentMode: StyleMode = bgStyle === 'solid' ? 'solid' : (gradientType as StyleMode);
  const setMode = (m: StyleMode) => {
    if (m === 'solid') {
      setBgStyle('solid');
      persist({ [cols.bg_style as string]: 'solid' });
    } else {
      setBgStyle('gradient');
      setGradientType(m);
      persist({ [cols.bg_style as string]: 'gradient', [cols.gradient_type as string]: m });
    }
  };

  // ── Interactive preview band — drag/click to set gradient centre ─────
  const previewRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const positionable = currentMode === 'radial' || currentMode === 'conic';

  const handlePoint = (clientX: number, clientY: number) => {
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    const rx = Math.round(x);
    const ry = Math.round(y);
    setCx(rx);
    setCy(ry);
  };

  // Persist only on pointerup to avoid hammering the DB on every move event.
  const commitPosition = () => persist({
    [cols.position_x as string]: cx,
    [cols.position_y as string]: cy,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (!positionable) return;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePoint(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    handlePoint(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    commitPosition();
  };

  const defaultTitle = variant === 'cover'
    ? 'Cover Background'
    : 'Quote Header Background';
  const defaultDescription = variant === 'cover'
    ? "Behind the cover splash. Doesn't affect the quote body."
    : "Behind the header band at the top of the quote body. Doesn't affect the cover splash.";

  return (
    <SectionCard
      title={title ?? defaultTitle}
      description={description ?? defaultDescription}
      icon={<Palette size={14} className="text-gray-400" />}
    >
      <div className="space-y-5">
        {/* Live preview band — interactive for radial/conic */}
        <div
          ref={previewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative w-full h-32 rounded-lg border border-gray-200 overflow-hidden ${
            positionable ? 'cursor-crosshair' : ''
          }`}
          style={{ background: gradientFor(bgStyle, gradientType, gradientAngle, cx, cy, bgColor1, bgColor2) }}
        >
          {positionable && (
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{
                left: `calc(${cx}% - 8px)`,
                top:  `calc(${cy}% - 8px)`,
                backgroundColor: 'rgba(0,0,0,0.25)',
              }}
            />
          )}
        </div>

        {/* 4-mode picker */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Fill</label>
          <div className="grid grid-cols-4 gap-2">
            {([
              { id: 'solid'  as const, label: 'Solid'  },
              { id: 'linear' as const, label: 'Linear' },
              { id: 'radial' as const, label: 'Radial' },
              { id: 'conic'  as const, label: 'Conic'  },
            ]).map((m) => {
              const active = currentMode === m.id;
              const swatch = m.id === 'solid'
                ? bgColor1
                : gradientFor('gradient', m.id, gradientAngle, cx, cy, bgColor1, bgColor2);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`p-2 rounded-lg border-2 transition-all text-center ${
                    active ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-full h-10 rounded mb-1.5" style={{ background: swatch }} />
                  <span className={`text-xs font-medium ${active ? 'text-teal' : 'text-gray-500'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Angle slider — linear + conic only */}
        {(currentMode === 'linear' || currentMode === 'conic') && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Angle</label>
              <span className="text-xs text-gray-700 tabular-nums">{gradientAngle}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={gradientAngle}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setGradientAngle(v);
                persist({ [cols.gradient_angle as string]: v });
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
            />
          </div>
        )}

        {/* Position sliders — radial + conic, mirror the drag handle */}
        {positionable && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Position X</label>
                <span className="text-xs text-gray-700 tabular-nums">{cx}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={cx}
                onChange={(e) => setCx(parseInt(e.target.value))}
                onMouseUp={commitPosition}
                onTouchEnd={commitPosition}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Position Y</label>
                <span className="text-xs text-gray-700 tabular-nums">{cy}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={cy}
                onChange={(e) => setCy(parseInt(e.target.value))}
                onMouseUp={commitPosition}
                onTouchEnd={commitPosition}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
              />
            </div>
          </div>
        )}

        {/* Colours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorPickerField
            label={currentMode === 'solid' ? 'Background' : 'Start'}
            value={bgColor1}
            fallback={HEADER_FALLBACK_1}
            onChange={(v) => { setBgColor1(v); persist({ [cols.bg_color_1 as string]: v }); }}
          />
          {currentMode !== 'solid' && (
            <ColorPickerField
              label="End"
              value={bgColor2}
              fallback={HEADER_FALLBACK_2}
              onChange={(v) => { setBgColor2(v); persist({ [cols.bg_color_2 as string]: v }); }}
            />
          )}
        </div>

        {/* Image overlay opacity — only relevant for the cover splash where
            a cover image can sit on top of the fill. */}
        {cols.overlay_opacity && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Image overlay opacity</label>
              <span className="text-xs text-gray-700 tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => {
                const v = parseInt(e.target.value) / 100;
                setOverlayOpacity(v);
                persist({ [cols.overlay_opacity as string]: v });
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
            />
            <p className="text-xs text-gray-400 mt-1">
              How much the fill above shows through the cover image.
            </p>
          </div>
        )}

        {/* Text colours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <ColorPickerField
            label="Header title text"
            value={coverTextColor}
            fallback="#ffffff"
            onChange={(v) => { setCoverTextColor(v); persist({ [cols.text_color as string]: v }); }}
          />
          <ColorPickerField
            label="Header subtitle text"
            value={coverSubtitleColor}
            fallback="#ffffffb3"
            onChange={(v) => { setCoverSubtitleColor(v); persist({ [cols.subtitle_color as string]: v }); }}
          />
        </div>
      </div>
    </SectionCard>
  );
}
