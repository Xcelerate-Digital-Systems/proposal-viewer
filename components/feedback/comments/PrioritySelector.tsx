'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const compute = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const popup = popupRef.current;
      const popupHeight = popup?.offsetHeight ?? 200;
      const popupWidth = popup?.offsetWidth ?? 176;
      const margin = 4;

      let top = rect.top - margin - popupHeight;
      if (top < 8) {
        top = rect.bottom + margin;
      }

      let left = rect.right - popupWidth;
      left = Math.min(Math.max(8, left), window.innerWidth - popupWidth - 8);

      setPos({ top, left });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const current = getPriorityDef(value);
  const CurrentIcon = current.icon;

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
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
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-[70] w-44 bg-white rounded-2xl border border-edge-strong shadow-lg py-1"
        >
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
