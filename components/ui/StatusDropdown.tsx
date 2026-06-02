// components/ui/StatusDropdown.tsx
'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  const portalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleDismiss = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    // Delay scroll/resize dismiss so residual scroll momentum from the
    // scrollable <main> container doesn't close the dropdown immediately.
    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 150);
    const guardedDismiss = () => { if (armed) handleDismiss(); };
    window.addEventListener('scroll', guardedDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      clearTimeout(armTimer);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', guardedDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [open, updatePos]);

  const current = options.find((o) => o.value === value);
  if (!current) return null;

  const isCompact = variant === 'compact';

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`} ref={ref}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 rounded-full font-medium transition-colors
          ${current.bg} ${current.text}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}
          ${fullWidth ? 'w-full' : ''}
          ${isCompact ? 'px-2.5 py-0.5 text-detail' : 'px-3 py-1 text-detail'}
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

      {/* Dropdown — rendered as a portal with fixed positioning to escape card stacking contexts */}
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            ref={portalRef}
            className="fixed z-[9999] bg-white rounded-2xl border border-edge shadow-[0_4px_24px_rgba(20,20,40,0.08)] py-1 min-w-[160px]"
            style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 160) }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface transition-colors ${
                  value === opt.value ? 'text-teal font-medium' : 'text-prose'
                }`}
              >
                {opt.icon}
                {opt.label}
                {value === opt.value && (
                  <CheckCircle2 size={11} className="ml-auto text-teal" />
                )}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}