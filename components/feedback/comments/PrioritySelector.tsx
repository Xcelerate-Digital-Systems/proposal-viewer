'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CircleMinus, Circle, CircleArrowDown, Check, Flag } from 'lucide-react';
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
  { value: 'normal', label: 'Normal', icon: Circle, iconClass: 'text-sky-500', badgeClass: 'bg-sky-100 text-sky-700' },
  { value: 'low', label: 'Low', icon: CircleArrowDown, iconClass: 'text-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { value: 'none', label: 'None', icon: Check, iconClass: 'text-blue-500', badgeClass: 'bg-gray-100 text-dim' },
];

export function getPriorityDef(priority: FeedbackCommentPriority): PriorityOptionDef {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[4];
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
            ? `inline-flex items-center gap-1 px-2 py-1 rounded-full text-detail font-medium transition-colors ${
                value === 'none'
                  ? 'text-dim hover:text-ink hover:bg-gray-100'
                  : current.badgeClass
              }`
            : 'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs text-prose bg-surface hover:bg-gray-100'
        }
        title={`Priority: ${current.label}`}
      >
        {value === 'none' ? (
          <>
            <Flag size={12} className="text-faint" />
            <span>Priority</span>
          </>
        ) : (
          <>
            <CurrentIcon size={12} className={current.iconClass} />
            <span>{current.label}</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-2xl border border-edge-strong shadow-lg py-1 z-50">
          <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-faint">
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
                  selected ? 'text-blue-600 font-semibold' : 'text-prose hover:bg-surface'
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
