'use client';

// Status pill + decision menu. Used in the markup viewer header so reviewers
// (admin + client) can move an item between client_review, revision_needed,
// approved, rejected.
//
// Design goals:
//  - The closed pill reads like a tag — colour-coded, dot + label + caret.
//  - The open menu reads like an action card — each option is its own
//    intentional decision with a one-line tagline so the reviewer knows what
//    each choice *commits to*.
//  - Internal stages (draft / in_progress / internal_review / archived) get a
//    neutral pill so a branded header stays legible while the item isn't yet
//    in front of the client.

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { REVIEW_STATUS_CONFIG, getFeedbackStatusDef } from '@/lib/feedback/status';
import type { FeedbackStatus } from '@/lib/supabase';

const CLIENT_STATUS_OPTIONS: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

const CLIENT_FACING: Set<FeedbackStatus> = new Set(CLIENT_STATUS_OPTIONS);

/** One-liners that nudge the reviewer toward the right choice. Keep short. */
const STATUS_TAGLINE: Partial<Record<FeedbackStatus, string>> = {
  client_review:   'Re-open for another round of review',
  revision_needed: 'Send back to the team for changes',
  approved:        'Sign off on this, ready to go live',
  rejected:        'Decline this version permanently',
};

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

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
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

  const useNeutralPill = !CLIENT_FACING.has(status);
  const neutralStyle = useNeutralPill && branded && sidebarText
    ? { border: `1px solid ${sidebarText}40`, color: sidebarText, backgroundColor: `${sidebarText}10` }
    : undefined;
  const neutralClass = useNeutralPill && !branded
    ? 'border border-edge-strong bg-surface text-prose'
    : '';
  const colouredClass = !useNeutralPill
    ? `border ${current.bg} ${current.text} ${current.border}`
    : '';

  return (
    <div ref={ref} className="relative inline-block" data-no-pin>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] font-semibold shadow-sm transition-all hover:shadow disabled:opacity-60 ${colouredClass} ${neutralClass} ${open ? 'ring-2 ring-offset-1 ring-black/5' : ''}`}
        style={neutralStyle}
      >
        {pending ? (
          <Loader2 size={11} className="animate-spin opacity-70" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
        )}
        <span className="tracking-tight">{current.label}</span>
        <span className="ml-0.5 h-3.5 w-px bg-current opacity-20" />
        <ChevronDown
          size={13}
          className={`opacity-60 transition-transform duration-150 ${open ? 'rotate-180 opacity-100' : 'group-hover:opacity-90'}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full right-0 mt-1.5 z-50 w-[280px] bg-white rounded-2xl border border-edge shadow-xl shadow-gray-900/5 py-1.5 origin-top-right animate-[fadeIn_120ms_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-1.5 pb-1">
            <p className="text-2xs font-semibold uppercase tracking-wider text-faint">
              Update status
            </p>
          </div>
          {CLIENT_STATUS_OPTIONS.map((opt) => {
            const def = getFeedbackStatusDef(opt);
            const isCurrent = opt === status;
            const tagline = STATUS_TAGLINE[opt];
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => handlePick(opt)}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                  isCurrent ? 'bg-surface' : 'hover:bg-surface/70'
                }`}
              >
                <div
                  className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${def.bg} ${def.text} ${def.border} border`}
                >
                  {def.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption font-semibold text-ink">{def.label}</span>
                    {isCurrent && (
                      <Check size={12} className="text-teal" />
                    )}
                  </div>
                  {tagline && (
                    <p className="text-detail text-dim leading-snug mt-0.5">
                      {tagline}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
