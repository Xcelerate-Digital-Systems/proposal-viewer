'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
import type { FeedbackStatus } from '@/lib/supabase';

// Limited set of statuses a client is allowed to set from the review link.
// Mirrors the allowlist in /api/review/[token]/items/[itemId]/status.
const CLIENT_STATUS_OPTIONS: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

interface Props {
  itemId: string;
  status: FeedbackStatus;
  onChange: (itemId: string, next: FeedbackStatus) => Promise<void> | void;
}

export default function ClientStatusControl({ itemId, status, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = REVIEW_STATUS_CONFIG[status];

  const handlePick = async (next: FeedbackStatus) => {
    setOpen(false);
    if (next === status) return;
    try {
      setPending(true);
      await onChange(itemId, next);
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={ref} className="relative inline-block" data-no-pin>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${current.bg} ${current.text} ${current.border} hover:brightness-95 disabled:opacity-60`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
        {current.label}
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-50 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {CLIENT_STATUS_OPTIONS.map((opt) => {
            const def = REVIEW_STATUS_CONFIG[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handlePick(opt)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 transition-colors ${
                  opt === status ? 'bg-gray-50' : ''
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${def.dot}`} />
                <span className="text-gray-700 truncate">{def.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
