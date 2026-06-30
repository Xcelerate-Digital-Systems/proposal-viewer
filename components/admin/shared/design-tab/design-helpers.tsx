'use client';

import { ChevronDown } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  FontSizeInput — number input with a px suffix                      */
/* ------------------------------------------------------------------ */

export function FontSizeInput({
  label,
  value,
  onChange,
  placeholder,
  min = 8,
  max = 96,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-prose">{label}</label>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-3 pr-9 py-2 text-sm border border-edge-strong rounded-lg bg-white text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-detail text-faint pointer-events-none">px</span>
      </div>
      <p className="text-detail text-faint">Leave blank to use the workspace default.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TipTap → plain text                                                */
/* ------------------------------------------------------------------ */

export interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

/** Flatten a TipTap document to plain text. Walks `content` recursively and
 *  concatenates `text` nodes, inserting a space between block siblings. */
export function tipTapToPlainText(node: unknown): string {
  const n = node as TipTapNode | null;
  if (!n) return '';
  if (typeof n.text === 'string') return n.text;
  if (!Array.isArray(n.content)) return '';
  return n.content
    .map((child) => tipTapToPlainText(child))
    .filter(Boolean)
    .join(' ');
}

/* ------------------------------------------------------------------ */
/*  Group heading                                                      */
/* ------------------------------------------------------------------ */

export function GroupHeading({ title, hint, open, onToggle }: { title: string; hint?: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full pt-4 text-left group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          <h3 className="text-xl font-semibold text-ink">{title}</h3>
          {hint && <span className="text-xs text-faint">{hint}</span>}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-faint group-hover:text-dim transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      <div className="mt-2 h-px bg-edge" />
    </button>
  );
}
