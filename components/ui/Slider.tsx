// components/ui/Slider.tsx
// Shared slider primitive — one source of truth for label / value badge /
// optional hint, used across the Design tab, Cover tab and Quote tab.
// Wraps the native input[type=range] with consistent track + thumb styling.
'use client';

interface SliderProps {
  /** Label shown above the track. */
  label: string;
  /** Current value (0..max). */
  value: number;
  /** Min value. Defaults to 0. */
  min?: number;
  /** Max value. Defaults to 100. */
  max?: number;
  /** Step. Defaults to 1. */
  step?: number;
  onChange: (value: number) => void;
  /** Called on mouseup / touchend / keyup — use this for the persist write so
   *  you don't fire 100 saves while the user is still dragging. */
  onCommit?: (value: number) => void;
  /** When set, formats the value badge — e.g. (v) => `${v}%`. Defaults to a plain number. */
  formatValue?: (value: number) => string;
  /** Optional helper text shown below the track in muted grey. */
  hint?: string;
  disabled?: boolean;
}

export default function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  formatValue,
  hint,
  disabled,
}: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-dim">{label}</label>
        <span className="text-xs text-prose tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit ? (e) => onCommit(Number((e.target as HTMLInputElement).value)) : undefined}
        onTouchEnd={onCommit ? (e) => onCommit(Number((e.target as HTMLInputElement).value)) : undefined}
        onKeyUp={onCommit ? (e) => onCommit(Number((e.target as HTMLInputElement).value)) : undefined}
        className="w-full h-2 bg-edge rounded-lg appearance-none cursor-pointer accent-teal disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {hint && <p className="text-xs text-faint mt-1">{hint}</p>}
    </div>
  );
}
