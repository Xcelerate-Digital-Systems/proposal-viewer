'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CircleMinus, CircleArrowDown, Check, Flag } from 'lucide-react';
import type { FeedbackCommentPriority } from '@/lib/types/feedback';

interface PrioritySelectorProps {
  value: FeedbackCommentPriority;
  onChange: (next: FeedbackCommentPriority) => void;
  /** Compact button (icon only, no label) — used inside the composer footer */
  compact?: boolean;
}

interface PriorityOptionDef {
  value: FeedbackCommentPriority;
  label: string;
  icon: typeof AlertCircle;
  iconClass: string;
  badgeClass: string;
}

export const PRIORITY_OPTIONS: PriorityOptionDef[] = [
  { value: 'high', label: 'High', icon: AlertCircle, iconClass: 'text-rose-500', badgeClass: 'bg-rose-100 text-rose-700' },
  { value: 'medium', label: 'Medium', icon: CircleMinus, iconClass: 'text-amber-500', badgeClass: 'bg-amber-100 text-amber-700' },
  { value: 'low', label: 'Low', icon: CircleArrowDown, iconClass: 'text-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { value: 'none', label: 'None', icon: Check, iconClass: 'text-blue-500', badgeClass: 'bg-gray-100 text-gray-500' },
];

export function getPriorityDef(priority: FeedbackCommentPriority): PriorityOptionDef {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[3];
}

export default function PrioritySelector({ value, onChange, compact = true }: PrioritySelectorProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const current = getPriorityDef(value);
  const CurrentIcon = current.icon;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          compact
            ? 'p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors'
            : 'flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50'
        }
        title={`Priority: ${current.label}`}
      >
        {value === 'none' ? (
          <Flag size={16} className="text-gray-400" />
        ) : (
          <CurrentIcon size={16} className={current.iconClass} />
        )}
        {!compact && <span>{current.label}</span>}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Set priority
          </p>
          {PRIORITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                  selected ? 'text-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} className={selected ? 'text-blue-600' : opt.iconClass} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
