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

const CLIENT_FACING: Set<FeedbackStatus> = new Set(CLIENT_STATUS_OPTIONS);

interface Props {
  itemId: string;
  status: FeedbackStatus;
  onChange: (itemId: string, next: FeedbackStatus) => Promise<void> | void;
  /** When the host header uses a dark/branded background, the control mirrors
   *  the edit/version button style for non-client-facing statuses so they stay
   *  visible without competing with the client-status colours. */
  branded?: boolean;
  /** Foreground colour used by the branded header — drives borders/text on
   *  the neutral pill variant. */
  sidebarText?: string;
}

export default function ClientStatusControl({ itemId, status, onChange, branded, sidebarText }: Props) {
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

  // Non-client-facing statuses (draft, in_progress, internal_review, archived)
  // get a neutral pill that matches the surrounding header chrome instead of
  // the coloured client-facing palette. This keeps the dark/branded header
  // legible when the project is still internal.
  const useNeutralPill = !CLIENT_FACING.has(status);
  const neutralStyle = useNeutralPill && branded && sidebarText
    ? { border: `1px solid ${sidebarText}40`, color: sidebarText, backgroundColor: `${sidebarText}10` }
    : undefined;
  const neutralClass = useNeutralPill && !branded
    ? 'border border-gray-200 bg-gray-50 text-gray-700'
    : '';
  const colouredClass = !useNeutralPill ? `border ${current.bg} ${current.text} ${current.border}` : '';

  return (
    <div ref={ref} className="relative inline-block" data-no-pin>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors hover:brightness-95 disabled:opacity-60 ${colouredClass} ${neutralClass}`}
        style={neutralStyle}
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
