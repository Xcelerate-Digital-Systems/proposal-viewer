// components/ui/StatusDropdown.tsx
'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StatusOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  bg: string;       // e.g. 'bg-emerald-50'
  text: string;      // e.g. 'text-emerald-700'
  border: string;    // e.g. 'border-emerald-200'
}

interface StatusDropdownProps<T extends string = string> {
  /** Current status value */
  value: T;
  /** Available status options */
  options: StatusOption<T>[];
  /** Called when user selects a new status */
  onChange: (value: T) => void;
  /** Display variant */
  variant?: 'default' | 'compact';
  /** Full width (default true) */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StatusDropdown<T extends string = string>({
  value,
  options,
  onChange,
  variant = 'default',
  fullWidth = true,
  disabled = false,
}: StatusDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const current = options.find((o) => o.value === value);
  if (!current) return null;

  const isCompact = variant === 'compact';

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`} ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 rounded-lg font-medium border transition-colors
          ${current.bg} ${current.text} ${current.border}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}
          ${fullWidth ? 'w-full' : ''}
          ${isCompact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1.5 text-xs'}
        `}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {current.icon}
          {current.label}
        </span>
        <ChevronDown
          size={isCompact ? 12 : 13}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[160px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                value === opt.value ? 'text-[#017C87] font-medium' : 'text-gray-700'
              }`}
            >
              {opt.icon}
              {opt.label}
              {value === opt.value && (
                <CheckCircle2 size={11} className="ml-auto text-[#017C87]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}