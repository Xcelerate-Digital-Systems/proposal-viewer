'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
import type { FeedbackItem, FeedbackStatus } from '@/lib/types/feedback';
import { Button } from '@/components/ui/Button';

interface CompleteFeedbackModalProps {
  shareToken: string;
  reviewerName: string;
  reviewerEmail: string;
  accentColor?: string;
  onClose: () => void;
  onSubmitted: () => void;
  /** Items the reviewer can update as part of finishing. Required when
   *  `mode === 'project'`; optional but recommended for `mode === 'item'`
   *  so we can render the active item's status picker. */
  items?: FeedbackItem[];
  /** When `mode === 'item'`, the id of the single item the reviewer is on. */
  activeItemId?: string | null;
  /** 'item' = render one status picker for the active item; 'project' =
   *  list every item currently in client review with its own picker. */
  mode?: 'item' | 'project';
}

const CLIENT_STATUS_OPTIONS: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

// Pill-style dropdown that mirrors the header's ClientStatusControl. Unlike
// that component it's controlled (no fetch on change) so the reviewer can
// stage edits before submitting.
function StatusPill({
  value,
  onChange,
}: {
  value: FeedbackStatus;
  onChange: (next: FeedbackStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = REVIEW_STATUS_CONFIG[value] ?? REVIEW_STATUS_CONFIG.client_review;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-detail font-medium border transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 ${current.bg} ${current.text} ${current.border} hover:brightness-95`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
        {current.label}
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Set item status"
            className="fixed z-[60] w-44 bg-white rounded-lg border border-edge-strong shadow-lg py-1"
            style={{ top: pos.top, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            {CLIENT_STATUS_OPTIONS.map((opt) => {
              const def = REVIEW_STATUS_CONFIG[opt];
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={opt === value}
                  onClick={() => {
                    setOpen(false);
                    onChange(opt);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface transition-colors focus-visible:bg-surface focus-visible:outline-none ${
                    opt === value ? 'bg-surface' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${def.dot}`} />
                  <span className="text-prose truncate">{def.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function CompleteFeedbackModal({
  shareToken,
  reviewerName,
  reviewerEmail,
  accentColor = '#017C87',
  onClose,
  onSubmitted,
  items,
  activeItemId,
  mode = 'project',
}: CompleteFeedbackModalProps) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Items the modal will let the reviewer update. In `item` mode that's
  // just the active item (if not already approved). In `project` mode it's
  // every item the client hasn't yet finalised — anything not approved,
  // rejected or archived.
  const PENDING_FOR_CLIENT = new Set<FeedbackStatus>([
    'draft',
    'in_progress',
    'internal_review',
    'client_review',
    'revision_needed',
  ]);
  const editableItems = useMemo(() => {
    if (!items) return [] as FeedbackItem[];
    if (mode === 'item') {
      const it = items.find((i) => i.id === activeItemId);
      return it && it.status !== 'approved' ? [it] : [];
    }
    return items.filter((i) => PENDING_FOR_CLIENT.has(i.status));
  }, [items, mode, activeItemId]);

  // Track the chosen status per item, seeded with whatever is current.
  const [statusMap, setStatusMap] = useState<Record<string, FeedbackStatus>>(() => {
    const m: Record<string, FeedbackStatus> = {};
    for (const i of editableItems) m[i.id] = i.status;
    return m;
  });

  useEffect(() => {
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const i of editableItems) {
        if (next[i.id] === undefined) next[i.id] = i.status;
      }
      for (const id of Object.keys(next)) {
        if (!editableItems.some((i) => i.id === id)) delete next[id];
      }
      return next;
    });
  }, [editableItems]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [bulkChoice, setBulkChoice] = useState<FeedbackStatus>('approved');

  const setAllStatuses = (next: FeedbackStatus) => {
    setBulkChoice(next);
    setStatusMap((prev) => {
      const updated = { ...prev };
      for (const it of editableItems) updated[it.id] = next;
      return updated;
    });
  };

  const handleFinish = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const item_statuses = editableItems
        .filter((i) => statusMap[i.id] && statusMap[i.id] !== i.status)
        .map((i) => ({ item_id: i.id, status: statusMap[i.id] }));

      const res = await fetch(`/api/review/${shareToken}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_name: reviewerName || null,
          reviewer_email: reviewerEmail || null,
          message: message.trim() || null,
          item_statuses,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to submit — please try again');
        setSubmitting(false);
        return;
      }

      toast.success('Thanks — your review has been sent');
      onSubmitted();
      onClose();
    } catch {
      toast.error('Failed to submit — please try again');
      setSubmitting(false);
    }
  };

  const showStatusList = editableItems.length > 0;
  const showBulkRow = mode === 'project' && editableItems.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      <div
        className="relative w-full max-w-[480px] max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] overflow-hidden animate-[cardIn_220ms_cubic-bezier(0.22,0.61,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: accentColor }} />

        <div className="flex items-start justify-between px-6 pt-5 pb-2 shrink-0">
          <h3 className="text-lg font-semibold text-ink">Complete your feedback</h3>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>

        <div className="px-6 pb-5 space-y-4 overflow-y-auto">
          {showStatusList && (
            <div className="space-y-2">
              <p className="text-caption text-prose">
                {mode === 'item'
                  ? 'Let us know where this item stands before you finish.'
                  : 'These items are waiting on your decision — set a status for each before submitting.'}
              </p>
              <div className="border border-edge rounded-2xl divide-y divide-gray-100">
                {showBulkRow && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-surface/60">
                    <p className="flex-1 min-w-0 text-caption font-medium text-prose">
                      Set all items to
                    </p>
                    <StatusPill value={bulkChoice} onChange={setAllStatuses} />
                  </div>
                )}
                {editableItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                    <p className="flex-1 min-w-0 truncate text-caption text-ink">{it.title}</p>
                    <StatusPill
                      value={statusMap[it.id] ?? it.status}
                      onChange={(next) =>
                        setStatusMap((prev) => ({ ...prev, [it.id]: next }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            autoFocus={!showStatusList}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Add a message (optional)"
            className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm text-ink placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ['--tw-ring-color' as string]: `${accentColor}25` }}
          />

          <button
            type="button"
            onClick={handleFinish}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? 'Sending…' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}
