// components/reviews/comments/GeneralCommentForm.tsx
'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import AttachmentPicker, { type PendingAttachment } from './AttachmentPicker';
import EmojiPicker from './EmojiPicker';
import type { ReviewCommentAttachment } from '@/lib/supabase';

interface GeneralCommentFormProps {
  onSubmit: (content: string, attachments?: ReviewCommentAttachment[]) => Promise<void>;
  /** Company ID for attachment uploads */
  companyId?: string;

  // Identity — provide authorName for team, or guestName+onNameChange for guests
  /** Team: fixed author name — displayed as "Posting as {authorName}" */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: callback when name changes */
  onNameChange?: (name: string) => void;
}

async function uploadAttachments(
  pending: PendingAttachment[],
  companyId: string
): Promise<ReviewCommentAttachment[]> {
  const results: ReviewCommentAttachment[] = [];
  for (const pa of pending) {
    const formData = new FormData();
    formData.append('file', pa.file);
    formData.append('company_id', companyId);

    const res = await fetch('/api/review-comments/attachments', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      results.push(await res.json());
    }
  }
  return results;
}

export default function GeneralCommentForm({
  onSubmit,
  companyId,
  authorName,
  guestName,
  onNameChange,
}: GeneralCommentFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  const isGuest = !authorName;
  const isDisabled = isGuest
    ? !text.trim() || !(guestName?.trim()) || submitting
    : !text.trim() || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);

    let attachments: ReviewCommentAttachment[] | undefined;
    if (pendingFiles.length > 0 && companyId) {
      attachments = await uploadAttachments(pendingFiles, companyId);
    }

    await onSubmit(text, attachments);
    setText('');
    setPendingFiles([]);
    setSubmitting(false);
    setExpanded(false);
  };

  return (
    <div className="border-t border-gray-200 px-4 py-3 shrink-0">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg text-xs text-gray-400 border border-gray-200 hover:border-gray-300 transition-colors"
        >
          Leave a general comment…
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          {authorName ? (
            <p className="text-[10px] text-gray-400">Posting as {authorName}</p>
          ) : (
            <input
              type="text"
              value={guestName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Your name"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
          )}

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Your comment…"
              className="w-full px-2.5 py-2 pr-8 rounded-lg border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
            <div className="absolute bottom-1.5 right-1.5">
              <EmojiPicker onSelect={(emoji) => setText((prev) => prev + emoji)} />
            </div>
          </div>

          <AttachmentPicker attachments={pendingFiles} onChange={setPendingFiles} />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setExpanded(false); setPendingFiles([]); }}
              className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDisabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal text-white text-xs font-medium hover:bg-[#01434A] disabled:opacity-40 transition-colors"
            >
              <Send size={11} />
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
