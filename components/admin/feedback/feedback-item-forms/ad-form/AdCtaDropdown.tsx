'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CTA_OPTIONS } from './ad-form-types';

export function AdCtaDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">CTA Button</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-surface rounded-2xl text-sm text-ink hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-teal/20"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={14} className={`text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-edge-strong shadow-lg overflow-hidden z-50">
          <div className="max-h-60 overflow-y-auto py-1">
            {CTA_OPTIONS.map((cta) => (
              <button
                key={cta}
                type="button"
                onClick={() => { onChange(cta); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  cta === value ? 'bg-teal/5 text-teal font-medium' : 'text-ink hover:bg-surface'
                }`}
              >
                {cta === value && <Check size={13} className="shrink-0" />}
                {cta !== value && <span className="w-[13px] shrink-0" />}
                {cta}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
