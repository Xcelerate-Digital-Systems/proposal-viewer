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

interface Props {
  proposal: Proposal;
  companyId: string;
  onSaved: () => void;
}

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

export default function HeaderStyleCard({ proposal, companyId, onSaved }: Props) {
  const toast = useToast();

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

  const [bgStyle, setBgStyle]             = useState<BgStyle>((proposal.cover_bg_style as BgStyle) || 'gradient');
  const [gradientType, setGradientType]   = useState<GradientType>((proposal.cover_gradient_type as GradientType) || 'linear');
  const [gradientAngle, setGradientAngle] = useState<number>(proposal.cover_gradient_angle ?? 135);
  const [cx, setCx]                       = useState<number>(proposal.cover_gradient_position_x ?? 50);
  const [cy, setCy]                       = useState<number>(proposal.cover_gradient_position_y ?? 50);
  const [bgColor1, setBgColor1]           = useState(proposal.cover_bg_color_1 ?? HEADER_FALLBACK_1);
  const [bgColor2, setBgColor2]           = useState(proposal.cover_bg_color_2 ?? HEADER_FALLBACK_2);
  const [coverTextColor, setCoverTextColor]         = useState(proposal.cover_text_color ?? '#ffffff');
  const [coverSubtitleColor, setCoverSubtitleColor] = useState(proposal.cover_subtitle_color ?? '#ffffffb3');
  const [overlayOpacity, setOverlayOpacity]         = useState<number>(proposal.cover_overlay_opacity ?? 0.65);

  const persist = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('proposals').update(patch).eq('id', proposal.id);
    if (error) { toast.error('Failed to save'); return; }
    onSaved();
  };

  const currentMode: StyleMode = bgStyle === 'solid' ? 'solid' : (gradientType as StyleMode);
  const setMode = (m: StyleMode) => {
    if (m === 'solid') {
      setBgStyle('solid');
      persist({ cover_bg_style: 'solid' });
    } else {
      setBgStyle('gradient');
      setGradientType(m);
      persist({ cover_bg_style: 'gradient', cover_gradient_type: m });
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
  const commitPosition = () => persist({ cover_gradient_position_x: cx, cover_gradient_position_y: cy });

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

  return (
    <SectionCard
      title="Header Background"
      description="Solid colour or gradient behind the cover header. For radial and conic gradients you can drag the centre on the preview."
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
                persist({ cover_gradient_angle: v });
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
            onChange={(v) => { setBgColor1(v); persist({ cover_bg_color_1: v }); }}
          />
          {currentMode !== 'solid' && (
            <ColorPickerField
              label="End"
              value={bgColor2}
              fallback={HEADER_FALLBACK_2}
              onChange={(v) => { setBgColor2(v); persist({ cover_bg_color_2: v }); }}
            />
          )}
        </div>

        {/* Image overlay opacity */}
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
              persist({ cover_overlay_opacity: v });
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
          />
          <p className="text-xs text-gray-400 mt-1">
            How much the fill above shows through the cover image.
          </p>
        </div>

        {/* Text colours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <ColorPickerField
            label="Header title text"
            value={coverTextColor}
            fallback="#ffffff"
            onChange={(v) => { setCoverTextColor(v); persist({ cover_text_color: v }); }}
          />
          <ColorPickerField
            label="Header subtitle text"
            value={coverSubtitleColor}
            fallback="#ffffffb3"
            onChange={(v) => { setCoverSubtitleColor(v); persist({ cover_subtitle_color: v }); }}
          />
        </div>
      </div>
    </SectionCard>
  );
}
