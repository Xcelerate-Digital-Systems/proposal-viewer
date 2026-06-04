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
import { supabase, type Proposal, type ProposalTemplate } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import ColorPickerField, { setBrandingColors } from '@/components/ui/ColorPickerField';
import Slider from '@/components/ui/Slider';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import GradientStopsEditor from '@/components/ui/GradientStopsEditor';
import { buildGradientCss, resolveStops, type GradientStop } from '@/lib/gradient-stops';

// Column-prefix config so the same card can edit either the cover splash
// (cover_*) or the quote-body header band (quote_header_*). Each path also
// reads its own preferred default; quote_header_* falls back to cover_* so
// existing quotes don't suddenly lose their styling.
export type HeaderStyleVariant = 'cover' | 'quote-header';

// Generalized so this card can edit either a `proposals` row or a
// `proposal_templates` row. Both tables expose the same cover_* / quote_header_*
// columns, so we just swap the table name on save.
type StylableEntity = Proposal | ProposalTemplate;
type StylableTable = 'proposals' | 'proposal_templates';

interface Props {
  proposal: StylableEntity;
  companyId: string;
  onSaved: () => void;
  variant?: HeaderStyleVariant;
  title?: string;
  description?: string;
  /** Defaults to 'proposals'. Pass 'proposal_templates' when editing a template. */
  table?: StylableTable;
  /** Skip the outer SectionCard chrome — used when this body is nested inside
   *  another card (e.g. the consolidated Cover Design card). */
  bare?: boolean;
  /** Hide the "Header title text" + "Header subtitle text" pickers at the
   *  bottom. CoverDesignPanel uses this so it can render those two colours
   *  in its own SectionCard following the unified flat layout. */
  hideTextColors?: boolean;
}

interface VariantCols {
  bg_style: keyof Proposal;
  bg_color_1: keyof Proposal;
  bg_color_2: keyof Proposal;
  gradient_type: keyof Proposal;
  gradient_angle: keyof Proposal;
  position_x: keyof Proposal;
  position_y: keyof Proposal;
  gradient_stops: keyof Proposal;
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
  gradient_stops: 'cover_gradient_stops',
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
  gradient_stops: 'quote_header_gradient_stops',
  text_color: 'quote_header_text_color',
  subtitle_color: 'quote_header_subtitle_color',
};

const HEADER_FALLBACK_1 = '#0f0f0f';
const HEADER_FALLBACK_2 = '#1e293b';

type BgStyle = 'gradient' | 'solid';
type GradientType = 'linear' | 'radial' | 'conic';
type StyleMode = 'solid' | GradientType;

export default function HeaderStyleCard({
  proposal,
  companyId,
  onSaved,
  variant = 'cover',
  title,
  description,
  table = 'proposals',
  bare = false,
  hideTextColors = false,
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
  const fbStops    = variant === 'quote-header' ? 'cover_gradient_stops'  : undefined;
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
  const [stops, setStops]                 = useState<GradientStop[]>(
    resolveStops(
      read<unknown>(cols.gradient_stops, fbStops),
      read<string>(cols.bg_color_1, fbColor1) ?? HEADER_FALLBACK_1,
      read<string>(cols.bg_color_2, fbColor2) ?? HEADER_FALLBACK_2,
    ),
  );
  const [coverTextColor, setCoverTextColor]         = useState(read<string>(cols.text_color, fbText) ?? '#ffffff');
  const [coverSubtitleColor, setCoverSubtitleColor] = useState(read<string>(cols.subtitle_color, fbSubtitle) ?? '#ffffffb3');
  const [overlayOpacity, setOverlayOpacity]         = useState<number>(
    cols.overlay_opacity ? Number(read<number>(cols.overlay_opacity) ?? 0.65) : 0.65,
  );

  const persist = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from(table).update(patch).eq('id', proposal.id);
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

  const body = (
    <div className="space-y-5">
        {/* Live preview band — interactive for radial/conic */}
        <div
          ref={previewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative w-full h-32 rounded-lg border border-edge-strong overflow-hidden ${
            positionable ? 'cursor-crosshair' : ''
          }`}
          style={{ background: buildGradientCss(bgStyle, gradientType, gradientAngle, cx, cy, stops) }}
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
          <label className="block text-xs text-dim mb-2">Fill</label>
          <div className="grid grid-cols-4 gap-2">
            {([
              { id: 'solid'  as const, label: 'Solid'  },
              { id: 'linear' as const, label: 'Linear' },
              { id: 'radial' as const, label: 'Radial' },
              { id: 'conic'  as const, label: 'Conic'  },
            ]).map((m) => {
              const active = currentMode === m.id;
              const swatch = m.id === 'solid'
                ? (stops[0]?.color ?? bgColor1)
                : buildGradientCss('gradient', m.id, gradientAngle, cx, cy, stops);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`p-2 rounded-lg border-2 transition-all text-center ${
                    active ? 'border-teal bg-teal/5' : 'border-edge-strong hover:border-edge-hover'
                  }`}
                >
                  <div className="w-full h-10 rounded mb-1.5" style={{ background: swatch }} />
                  <span className={`text-xs font-medium ${active ? 'text-teal' : 'text-dim'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Angle slider — linear + conic only */}
        {(currentMode === 'linear' || currentMode === 'conic') && (
          <Slider
            label="Angle"
            value={gradientAngle}
            min={0}
            max={360}
            formatValue={(v) => `${v}°`}
            onChange={(v) => {
              setGradientAngle(v);
              persist({ [cols.gradient_angle as string]: v });
            }}
          />
        )}

        {/* Position sliders — radial + conic, mirror the drag handle */}
        {positionable && (
          <div className="grid grid-cols-2 gap-3">
            <Slider
              label="Position X"
              value={cx}
              formatValue={(v) => `${v}%`}
              onChange={setCx}
              onCommit={() => commitPosition()}
            />
            <Slider
              label="Position Y"
              value={cy}
              formatValue={(v) => `${v}%`}
              onChange={setCy}
              onCommit={() => commitPosition()}
            />
          </div>
        )}

        {/* Colours */}
        {currentMode === 'solid' ? (
          <SolidColorRow
            value={stops[0]?.color ?? bgColor1}
            onChange={(v) => {
              setBgColor1(v);
              const next: GradientStop[] = stops.length
                ? stops.map((s, i) => (i === 0 ? { ...s, color: v } : s))
                : [{ color: v, position: 0 }, { color: bgColor2, position: 100 }];
              setStops(next);
              persist({
                [cols.bg_color_1 as string]: v,
                [cols.gradient_stops as string]: next,
              });
            }}
          />
        ) : (
          <GradientStopsEditor
            stops={stops}
            onChange={setStops}
            onCommit={(next) => {
              // Keep the legacy bg_color_1/2 columns in sync with the first/last
              // stop so renderers that haven't been updated still show the
              // user's gradient endpoints.
              const first = next[0]?.color ?? bgColor1;
              const last = next[next.length - 1]?.color ?? bgColor2;
              setBgColor1(first);
              setBgColor2(last);
              persist({
                [cols.gradient_stops as string]: next,
                [cols.bg_color_1 as string]: first,
                [cols.bg_color_2 as string]: last,
              });
            }}
          />
        )}

        {/* Colour overlay opacity — only relevant when a cover image is set.
            Controls how much of the fill (solid/gradient) colour-tints the image.
            0% = the raw image with no colour wash; 100% = fully obscured. */}
        {cols.overlay_opacity && (
          <Slider
            label="Colour overlay opacity"
            value={Math.round(overlayOpacity * 100)}
            formatValue={(v) => `${v}%`}
            hint="How much the fill colour shows over the cover image. 0% = no tint."
            onChange={(pct) => {
              const v = pct / 100;
              setOverlayOpacity(v);
              persist({ [cols.overlay_opacity as string]: v });
            }}
          />
        )}

        {/* Text colours — hidden when the consumer renders them in a separate
            SectionCard (CoverDesignPanel uses this for the unified layout). */}
        {!hideTextColors && (
          <div className="space-y-4 pt-3 border-t border-edge">
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
        )}
      </div>
  );

  if (bare) return body;

  return (
    <SectionCard
      title={title ?? defaultTitle}
      description={description ?? defaultDescription}
      icon={<Palette size={14} className="text-faint" />}
    >
      {body}
    </SectionCard>
  );
}

function SolidColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ColorPickerField
      label="Background"
      value={value}
      fallback={HEADER_FALLBACK_1}
      onChange={onChange}
    />
  );
}
