'use client';

import { useEffect, useState } from 'react';
import { fontFamily } from '@/lib/google-fonts';

interface ReviewerNoteOverlayProps {
  /** Share token — used as a cache key so acks are per-link. */
  shareToken: string;
  /** The note body to show. */
  note: string;
  /** Timestamp from review_projects. Used to invalidate ack when the note is edited. */
  updatedAt: string | null;
  /** Brand accent (optional — defaults to teal). */
  accentColor?: string;
  /** Brand logo — shown top-left when present. */
  logoUrl?: string | null;
  /** Company name — used as heading context. */
  companyName?: string | null;
  /** Optional heading font family. */
  fontHeading?: string | null;
}

const ACK_PREFIX = 'av-reviewer-note-ack-';

/**
 * First-load greeting shown to reviewers opening a shared link when the
 * project owner has enabled "show this note to reviewers". Dismissal is
 * remembered in localStorage per (share_token, reviewer_note_updated_at)
 * so that editing the note re-shows it for everyone.
 */
export default function ReviewerNoteOverlay({
  shareToken,
  note,
  updatedAt,
  accentColor = '#017C87',
  logoUrl,
  companyName,
  fontHeading,
}: ReviewerNoteOverlayProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!note.trim()) return;
    const key = ACK_PREFIX + shareToken;
    const stored = window.localStorage.getItem(key);
    // stored is the updatedAt we previously ack'd; if it matches current, stay hidden.
    if (stored && stored === (updatedAt ?? '')) return;
    setOpen(true);
  }, [shareToken, note, updatedAt]);

  if (!open) return null;

  const headingFont = fontHeading ? fontFamily(fontHeading) : undefined;
  const initial = (companyName?.trim()?.[0] ?? 'N').toUpperCase();

  const dismiss = () => {
    try {
      window.localStorage.setItem(ACK_PREFIX + shareToken, updatedAt ?? '');
    } catch {
      // ignore — storage may be blocked; we'll just show again next load
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reviewer-note-title"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      <div
        className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] overflow-hidden animate-[cardIn_220ms_cubic-bezier(0.22,0.61,0.36,1)]"
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

        <div className="px-7 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName ?? 'Brand logo'}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-base font-semibold shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                {initial}
              </div>
            )}
            {companyName && !logoUrl && (
              <span
                className="text-sm font-semibold text-ink truncate"
                style={{ fontFamily: headingFont }}
              >
                {companyName}
              </span>
            )}
          </div>

          <h2
            id="reviewer-note-title"
            className="text-xl leading-tight font-semibold text-ink"
            style={{ fontFamily: headingFont }}
          >
            Note to reviewers
          </h2>

          <p className="mt-4 text-sm text-prose leading-relaxed whitespace-pre-wrap">
            {note}
          </p>

          <button
            type="button"
            onClick={dismiss}
            className="mt-6 w-full px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:brightness-110 shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
