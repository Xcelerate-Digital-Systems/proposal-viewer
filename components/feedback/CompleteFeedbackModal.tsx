'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface CompleteFeedbackModalProps {
  shareToken: string;
  reviewerName: string;
  reviewerEmail: string;
  accentColor?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

/**
 * "Complete your feedback" modal triggered from the reviewer-side Finish
 * button. Captures an optional closing message and POSTs to
 * /api/review/[token]/complete, which records the row and fires the
 * review_feedback_marked_complete webhook.
 */
export default function CompleteFeedbackModal({
  shareToken,
  reviewerName,
  reviewerEmail,
  accentColor = '#017C87',
  onClose,
  onSubmitted,
}: CompleteFeedbackModalProps) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      const res = await fetch(`/api/review/${shareToken}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_name: reviewerName || null,
          reviewer_email: reviewerEmail || null,
          message: message.trim() || null,
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
        className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] overflow-hidden animate-[cardIn_220ms_cubic-bezier(0.22,0.61,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

        <div className="flex items-start justify-between px-6 pt-5 pb-2">
          <h3 className="text-lg font-semibold text-gray-900">Complete your feedback</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
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
