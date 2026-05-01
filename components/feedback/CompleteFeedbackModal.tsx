'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { FeedbackItem, FeedbackStatus } from '@/lib/types/feedback';

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
   *  list every non-approved item with its own picker. */
  mode?: 'item' | 'project';
}

const CLIENT_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'client_review', label: 'In review' },
  { value: 'revision_needed', label: 'Needs revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

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
  // just the active item (if not already approved); in `project` mode it's
  // every non-approved item.
  const editableItems = useMemo(() => {
    if (!items) return [] as FeedbackItem[];
    if (mode === 'item') {
      const it = items.find((i) => i.id === activeItemId);
      return it && it.status !== 'approved' ? [it] : [];
    }
    return items.filter((i) => i.status !== 'approved');
  }, [items, mode, activeItemId]);

  // Track the chosen status per item, seeded with whatever is current.
  const [statusMap, setStatusMap] = useState<Record<string, FeedbackStatus>>(() => {
    const m: Record<string, FeedbackStatus> = {};
    for (const i of editableItems) m[i.id] = i.status;
    return m;
  });

  useEffect(() => {
    // When the editable item set changes, reseed any newly-included items
    // without clobbering choices the reviewer has already made.
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const i of editableItems) {
        if (next[i.id] === undefined) next[i.id] = i.status;
      }
      // Drop entries for items no longer in scope (e.g. just got approved).
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

  const handleFinish = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Only send the rows where the reviewer actually changed something.
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

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center p-5 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
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
          <h3 className="text-lg font-semibold text-gray-900">Complete your feedback</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-5 space-y-4 overflow-y-auto">
          {showStatusList && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider">
                {mode === 'item' ? 'Set status' : 'Set status for each item'}
              </p>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                {editableItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                    <p className="flex-1 min-w-0 truncate text-[13px] text-gray-800">{it.title}</p>
                    <select
                      value={statusMap[it.id] ?? it.status}
                      onChange={(e) =>
                        setStatusMap((prev) => ({
                          ...prev,
                          [it.id]: e.target.value as FeedbackStatus,
                        }))
                      }
                      className="text-[12px] px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2"
                      style={{ ['--tw-ring-color' as string]: `${accentColor}25` }}
                    >
                      {CLIENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
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
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ['--tw-ring-color' as string]: `${accentColor}25` }}
          />

          <button
            type="button"
            onClick={handleFinish}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? 'Sending…' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}
