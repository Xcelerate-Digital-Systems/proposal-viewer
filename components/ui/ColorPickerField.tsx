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
  // Notify all mounted instances
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
}: ColorPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const recent = useRecentColors();

  const displayColor = value || fallback;
  const isCustom = !!value;

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

  const handleHexSubmit = () => {
    let hex = hexInput.trim();
    if (!hex.startsWith('#')) hex = `#${hex}`;
    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
      applyColor(hex);
    }
  };

  const handleClose = () => {
    // Track the final colour as recently used on close
    if (isCustom && value) addRecentColor(value);
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-600">{label}</span>
        {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
      </div>

      <div className="relative flex items-center gap-1.5" ref={popoverRef}>
        {/* Swatch button */}
        <button
          onClick={() => setOpen(!open)}
          className={`
            w-8 h-8 rounded-lg border-2 transition-all shadow-sm
            hover:scale-105 hover:shadow-md active:scale-95
            ${isCustom ? 'border-gray-300' : 'border-gray-200 border-dashed'}
          `}
          style={{ backgroundColor: displayColor }}
          title={`${displayColor} — click to change`}
        >
          <span className="sr-only">{displayColor}</span>
        </button>

        {/* Hex badge */}
        <span className="text-[10px] text-gray-400 font-mono w-[54px] text-center select-all">
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
            {/* Native colour picker — styled large */}
            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-100 mb-3">
              <input
                type="color"
                value={displayColor}
                onChange={(e) => {
                  applyColor(e.target.value);
                  setHexInput(e.target.value);
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

            {/* Recently used colours */}
            {recent.length > 0 && (
              <div className="mb-3">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Recent</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {recent.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        applyColor(c);
                        setHexInput(c);
                      }}
                      className={`w-6 h-6 rounded-md border transition-all hover:scale-110 ${
                        displayColor.toLowerCase() === c
                          ? 'border-[#017C87] ring-2 ring-[#017C87]/20'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hex input */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus-within:border-[#017C87] focus-within:ring-2 focus-within:ring-[#017C87]/10 transition-all">
                <span className="text-[10px] text-gray-400 font-mono">#</span>
                <input
                  type="text"
                  value={hexInput.replace('#', '')}
                  onChange={(e) => setHexInput(`#${e.target.value.replace('#', '')}`)}
                  onBlur={handleHexSubmit}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(); }}
                  maxLength={6}
                  className="flex-1 bg-transparent text-xs font-mono text-gray-700 outline-none w-0"
                  placeholder="000000"
                />
              </div>
              {/* Preview swatch */}
              <div
                className="w-8 h-8 rounded-lg border border-gray-200 shrink-0"
                style={{ backgroundColor: displayColor }}
              />
            </div>

            {/* Done button */}
            <button
              onClick={handleClose}
              className="w-full mt-2.5 py-1.5 text-[11px] font-medium text-[#017C87] bg-[#017C87]/5 rounded-lg hover:bg-[#017C87]/10 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}