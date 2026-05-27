// components/ui/GradientStopsEditor.tsx
// Figma-style multi-stop gradient editor. Renders a horizontal track that
// previews the linear interpolation of the stops, with draggable thumbs you
// can move to any 0-100 position. Use the "Add stop" button to insert a new
// stop, click a thumb to select it and edit its colour (or remove it; minimum
// two stops). The track itself does not add stops on click — that proved too
// easy to trigger accidentally while dragging.
'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { GradientStop } from '@/lib/gradient-stops';
import ColorPickerField from '@/components/ui/ColorPickerField';

interface Props {
  stops: GradientStop[];
  onChange: (next: GradientStop[]) => void;
  /** Called when the user finishes a drag / picks a colour, so the parent can
   *  persist. Receives the same array passed to onChange most recently. */
  onCommit?: (next: GradientStop[]) => void;
}

export default function GradientStopsEditor({ stops, onChange, onCommit }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const draggingRef = useRef<number | null>(null);

  // Build the linear track preview from current stops.
  const trackCss = stops.length >= 2
    ? `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.position}%`).join(', ')})`
    : (stops[0]?.color ?? '#cccccc');

  const setStops = (next: GradientStop[]) => onChange(next);
  const commit = (next: GradientStop[]) => onCommit?.(next);

  const xToPosition = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, Math.round(x * 100)));
  };

  const onThumbPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    setSelected(i);
    draggingRef.current = i;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onTrackPointerMove = (e: React.PointerEvent) => {
    const i = draggingRef.current;
    if (i === null) return;
    const pos = xToPosition(e.clientX);
    const next = stops.map((s, idx) => (idx === i ? { ...s, position: pos } : s));
    setStops(next);
  };
  const onTrackPointerUp = () => {
    if (draggingRef.current === null) return;
    // Re-sort by position on commit so subsequent edits operate on the visual
    // order. Track the previously-selected stop so the highlight follows it.
    const wasSelectedRef = stops[draggingRef.current];
    draggingRef.current = null;
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    setStops(sorted);
    commit(sorted);
    if (wasSelectedRef) {
      const idx = sorted.indexOf(wasSelectedRef);
      if (idx >= 0) setSelected(idx);
    }
  };

  const removeStop = (i: number) => {
    if (stops.length <= 2) return; // gradients need at least two stops
    const next = stops.filter((_, idx) => idx !== i);
    setStops(next);
    commit(next);
    setSelected(Math.max(0, Math.min(i, next.length - 1)));
  };

  const updateSelectedColor = (color: string) => {
    if (selected < 0 || selected >= stops.length) return;
    const next = stops.map((s, idx) => (idx === selected ? { ...s, color } : s));
    setStops(next);
    commit(next);
  };

  const updateSelectedPosition = (position: number) => {
    if (selected < 0 || selected >= stops.length) return;
    const next = stops.map((s, idx) => (idx === selected ? { ...s, position } : s));
    setStops(next);
  };

  const addAtMidpoint = () => {
    // Drop a new stop at the largest gap so each click reliably adds a visible
    // thumb rather than overlapping an existing one.
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    let gapStart = 0;
    let gapEnd = 100;
    let biggest = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].position - sorted[i].position;
      if (gap > biggest) {
        biggest = gap;
        gapStart = sorted[i].position;
        gapEnd = sorted[i + 1].position;
      }
    }
    const pos = Math.round((gapStart + gapEnd) / 2);
    const colour = sampleColorAt(stops, pos);
    const next = [...stops, { color: colour, position: pos }].sort(
      (a, b) => a.position - b.position,
    );
    setStops(next);
    commit(next);
    setSelected(next.findIndex((s) => s.position === pos && s.color === colour));
  };

  const sel = stops[selected];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-dim">Gradient stops</label>
        <button
          type="button"
          onClick={addAtMidpoint}
          className="flex items-center gap-1 text-xs text-teal hover:underline"
        >
          <Plus size={12} /> Add stop
        </button>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
        className="relative h-8 rounded-lg border border-edge-strong"
        style={{ background: trackCss }}
      >
        {stops.map((s, i) => (
          <button
            key={i}
            type="button"
            data-stop-thumb
            onPointerDown={onThumbPointerDown(i)}
            onClick={(e) => { e.stopPropagation(); setSelected(i); }}
            className={`absolute top-1/2 w-4 h-6 -translate-y-1/2 -translate-x-1/2 rounded border-2 shadow-sm transition-all ${
              selected === i ? 'border-teal scale-110' : 'border-white'
            }`}
            style={{
              left: `${s.position}%`,
              backgroundColor: s.color,
              outline: '1px solid rgba(0,0,0,0.25)',
            }}
            aria-label={`Stop ${i + 1} at ${s.position}%`}
          />
        ))}
      </div>

      {/* Selected stop controls */}
      {sel && (
        <div className="rounded-lg border border-edge bg-surface/60 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dim">Selected stop</span>
            <button
              type="button"
              onClick={() => removeStop(selected)}
              disabled={stops.length <= 2}
              className="flex items-center gap-1 text-xs text-red-500 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              <X size={11} /> Remove
            </button>
          </div>
          <ColorPickerField
            label="Colour"
            value={sel.color}
            fallback="#000000"
            onChange={updateSelectedColor}
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-dim">Position</label>
              <span className="text-xs text-prose tabular-nums">{sel.position}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sel.position}
              onChange={(e) => updateSelectedPosition(parseInt(e.target.value))}
              onMouseUp={() => commit(stops)}
              onTouchEnd={() => commit(stops)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
            />
          </div>
        </div>
      )}

      <p className="text-detail text-faint">
        Drag a stop to reposition, click to recolour. Use &ldquo;Add stop&rdquo; to insert a new one.
      </p>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // strip alpha
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Interpolate the colour at `pos` (0-100) along the existing stop list so a
 *  newly-added stop blends visually instead of jumping. */
function sampleColorAt(stops: GradientStop[], pos: number): string {
  if (stops.length === 0) return '#888888';
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (pos <= sorted[0].position) return sorted[0].color;
  if (pos >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (pos >= a.position && pos <= b.position) {
      const t = clamp01((pos - a.position) / (b.position - a.position || 1));
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      if (!ca || !cb) return a.color;
      return rgbToHex(
        ca[0] + (cb[0] - ca[0]) * t,
        ca[1] + (cb[1] - ca[1]) * t,
        ca[2] + (cb[2] - ca[2]) * t,
      );
    }
  }
  return sorted[sorted.length - 1].color;
}
