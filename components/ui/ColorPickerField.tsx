// components/ui/ColorPickerField.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Recently used colours — shared across all instances in the session */
/* ------------------------------------------------------------------ */

const MAX_RECENT = 8;
let recentColors: string[] = [];
let recentListeners: Set<() => void> = new Set();

function addRecentColor(color: string) {
  const hex = color.toLowerCase();
  recentColors = [hex, ...recentColors.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  recentListeners.forEach((fn) => fn());
}

function useRecentColors(): string[] {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((v) => v + 1);
    recentListeners.add(listener);
    return () => { recentListeners.delete(listener); };
  }, []);

  return recentColors;
}

/* ------------------------------------------------------------------ */
/*  Branding colours — set once from company settings, shared globally */
/* ------------------------------------------------------------------ */

let brandingColors: string[] = [];
let brandingListeners: Set<() => void> = new Set();

export function setBrandingColors(colors: string[]) {
  // Deduplicate and normalise
  const seen = new Set<string>();
  brandingColors = colors
    .filter(Boolean)
    .map((c) => c.toLowerCase())
    .filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; });
  brandingListeners.forEach((fn) => fn());
}

function useBrandingColors(): string[] {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((v) => v + 1);
    brandingListeners.add(listener);
    return () => { brandingListeners.delete(listener); };
  }, []);

  return brandingColors;
}

/* ------------------------------------------------------------------ */
/*  Hex + alpha helpers                                                */
/* ------------------------------------------------------------------ */

/** Splits "#rrggbbaa" / "#rrggbb" / "#rgb" into a 6-digit base + alpha 0..1. */
function parseColor(input: string): { base: string; alpha: number } {
  let hex = (input || '').trim().toLowerCase();
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6 && hex.length !== 8) return { base: '#000000', alpha: 1 };
  const base = `#${hex.slice(0, 6)}`;
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { base, alpha };
}

/** Builds an emitted hex string. Drops the alpha pair when fully opaque so
 *  existing 6-digit values stay canonical and don't gain a noisy "ff" suffix. */
function composeColor(base: string, alpha: number): string {
  const b = base.toLowerCase();
  if (alpha >= 0.999) return b;
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255))).toString(16).padStart(2, '0');
  return `${b}${a}`;
}

/** Validates 3/6/8 hex digits (with or without leading #). */
function isValidHex(input: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(input.trim());
}

/** Inline checker pattern, surfaced behind translucent swatches. */
const CHECKER_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #d4d4d4 25%, transparent 25%),' +
    'linear-gradient(-45deg, #d4d4d4 25%, transparent 25%),' +
    'linear-gradient(45deg, transparent 75%, #d4d4d4 75%),' +
    'linear-gradient(-45deg, transparent 75%, #d4d4d4 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ColorPickerFieldProps {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string) => void;
  onReset?: () => void;
  /** Optional description shown below the label */
  hint?: string;
  disabled?: boolean;
  /** Renders only the swatch button + popover, no label/hex/reset chrome */
  swatchOnly?: boolean;
  /** Open the picker immediately on mount (used when adding a new swatch) */
  defaultOpen?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ColorPickerField({
  label,
  value,
  fallback,
  onChange,
  onReset,
  hint,
  disabled,
  swatchOnly,
  defaultOpen,
}: ColorPickerFieldProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [hexInput, setHexInput] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const recent = useRecentColors();
  const branding = useBrandingColors();

  const displayColor = value || fallback;
  const isCustom = !!value;
  const { base: displayBase, alpha: displayAlpha } = parseColor(displayColor);
  const hasTransparency = displayAlpha < 0.999;
  const alphaPct = Math.round(displayAlpha * 100);

  // Sync hex input when picker opens or value changes
  useEffect(() => {
    if (open) setHexInput(displayColor);
  }, [open, displayColor]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyColor = useCallback((hex: string) => {
    onChange(hex);
    addRecentColor(hex);
  }, [onChange]);

  /** Apply only the base (RGB) portion, preserving the current alpha — used
   *  when clicking a brand or recent swatch so toggling palette colours
   *  doesn't wipe the user's transparency choice. */
  const applyBase = useCallback((baseHex: string) => {
    const composed = composeColor(baseHex, displayAlpha);
    onChange(composed);
    addRecentColor(composed);
    setHexInput(composed);
  }, [onChange, displayAlpha]);

  const applyAlpha = useCallback((nextAlpha: number) => {
    const composed = composeColor(displayBase, nextAlpha);
    onChange(composed);
    setHexInput(composed);
  }, [onChange, displayBase]);

  const handleHexSubmit = () => {
    const raw = hexInput.trim();
    if (!isValidHex(raw)) return;
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    applyColor(normalized.toLowerCase());
  };

  const handleClose = () => {
    // Track the final colour as recently used on close
    if (isCustom && value) addRecentColor(value);
    setOpen(false);
  };

  /* ── Shared popover body — picker + alpha + swatches + hex ──────── */
  const renderPopoverBody = () => (
    <>
      {/* Native colour picker — base RGB only (HTML input[type=color] has no alpha) */}
      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-100 mb-3">
        <input
          type="color"
          value={displayBase}
          onChange={(e) => {
            const composed = composeColor(e.target.value, displayAlpha);
            applyColor(composed);
            setHexInput(composed);
          }}
          className="absolute inset-0 w-full h-full cursor-pointer border-0 p-0"
          style={{ appearance: 'none', WebkitAppearance: 'none' }}
        />
        <style>{`
          input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
          input[type="color"]::-webkit-color-swatch { border: none; border-radius: 0; }
          input[type="color"]::-moz-color-swatch { border: none; border-radius: 0; }
        `}</style>
      </div>

      {/* Alpha slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Opacity</span>
          <span className="text-[10px] font-mono text-gray-500">{alphaPct}%</span>
        </div>
        <div className="relative h-5 rounded-md overflow-hidden border border-gray-100" style={CHECKER_BG}>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to right, ${displayBase}00, ${displayBase}ff)` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={alphaPct}
            onChange={(e) => applyAlpha(Number(e.target.value) / 100)}
            className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
            aria-label="Opacity"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
            style={{ left: `calc(${alphaPct}% - 6px)`, backgroundColor: displayBase }}
          />
        </div>
      </div>

      {/* Brand colours */}
      {branding.length > 0 && (
        <div className="mb-3">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Brand</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {branding.map((c) => (
              <button
                key={c}
                onClick={() => applyBase(c)}
                className={`w-6 h-6 rounded-md border transition-all hover:scale-110 ${
                  displayBase === c
                    ? 'border-teal ring-2 ring-teal/20'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently used colours */}
      {recent.length > 0 && (
        <div className="mb-3">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Recent</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {recent.map((c) => {
              const r = parseColor(c);
              const isSelected = c === displayColor.toLowerCase();
              return (
                <button
                  key={c}
                  onClick={() => { applyColor(c); setHexInput(c); }}
                  className={`relative w-6 h-6 rounded-md border transition-all hover:scale-110 overflow-hidden ${
                    isSelected ? 'border-teal ring-2 ring-teal/20' : 'border-gray-200 hover:border-gray-400'
                  }`}
                  title={c}
                >
                  {r.alpha < 0.999 && (
                    <span className="absolute inset-0" style={CHECKER_BG} />
                  )}
                  <span className="absolute inset-0" style={{ backgroundColor: c }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hex input + preview */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/10 transition-all">
          <span className="text-[10px] text-gray-400 font-mono">#</span>
          <input
            type="text"
            value={hexInput.replace('#', '')}
            onChange={(e) => setHexInput(`#${e.target.value.replace('#', '')}`)}
            onBlur={handleHexSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(); }}
            maxLength={8}
            className="flex-1 bg-transparent text-xs font-mono text-gray-700 outline-none w-0"
            placeholder="000000"
          />
        </div>
        <div className="relative w-8 h-8 rounded-lg border border-gray-200 shrink-0 overflow-hidden">
          {hasTransparency && <div className="absolute inset-0" style={CHECKER_BG} />}
          <div className="absolute inset-0" style={{ backgroundColor: displayColor }} />
        </div>
      </div>

      <button
        onClick={handleClose}
        className="w-full mt-2.5 py-1.5 text-[11px] font-medium text-teal bg-teal/5 rounded-lg hover:bg-teal/10 transition-colors"
      >
        Done
      </button>
    </>
  );

  if (swatchOnly) {
    return (
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`relative w-9 h-9 rounded-xl border-2 transition-all shadow-sm overflow-hidden ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer'
          } border-gray-200`}
          title={disabled ? displayColor : `${displayColor} — click to change`}
        >
          {hasTransparency && <span className="absolute inset-0" style={CHECKER_BG} />}
          <span className="absolute inset-0" style={{ backgroundColor: displayColor }} />
          <span className="sr-only">{displayColor}</span>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-xl shadow-black/10 p-3 w-[220px]">
            {renderPopoverBody()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-600">{label}</span>
        {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
      </div>

      <div className="relative flex items-center gap-1.5" ref={popoverRef}>
        {/* Swatch button */}
        <button
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`
            relative w-8 h-8 rounded-lg border-2 transition-all shadow-sm overflow-hidden
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer'}
            ${isCustom ? 'border-gray-300' : 'border-gray-200 border-dashed'}
          `}
          title={disabled ? displayColor : `${displayColor} — click to change`}
        >
          {hasTransparency && <span className="absolute inset-0" style={CHECKER_BG} />}
          <span className="absolute inset-0" style={{ backgroundColor: displayColor }} />
          <span className="sr-only">{displayColor}</span>
        </button>

        {/* Hex badge */}
        <span className="text-[10px] text-gray-400 font-mono w-[64px] text-center select-all">
          {displayColor}
        </span>

        {/* Reset button */}
        {isCustom && onReset && (
          <button
            onClick={(e) => { e.stopPropagation(); onReset(); setOpen(false); }}
            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            title="Reset to default"
          >
            <X size={10} />
          </button>
        )}

        {/* Popover */}
        {open && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-xl shadow-black/10 p-3 w-[220px]">
            {renderPopoverBody()}
          </div>
        )}
      </div>
    </div>
  );
}