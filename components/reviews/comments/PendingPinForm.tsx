// components/reviews/comments/PendingPinForm.tsx
'use client';

import { useState } from 'react';
import { MapPin, Send, X } from 'lucide-react';
import AttachmentPicker, { type PendingAttachment } from './AttachmentPicker';
import EmojiPicker from './EmojiPicker';
import type { ReviewCommentAttachment } from '@/lib/supabase';

interface PendingPinFormProps {
  onSubmit: (content: string, attachments?: ReviewCommentAttachment[]) => Promise<void>;
  onCancel: () => void;
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

export default function PendingPinForm({
  onSubmit,
  onCancel,
  companyId,
  authorName,
  guestName,
  onNameChange,
}: PendingPinFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-teal/30 bg-teal/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-teal" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-teal">
          New Pin Comment
        </span>
        <button type="button" onClick={onCancel} className="ml-auto p-0.5 text-gray-400 hover:text-gray-600">
          <X size={12} />
        </button>
      </div>

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
          placeholder="Describe your feedback…"
          className="w-full px-2.5 py-2 pr-8 rounded-lg border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
        />
        <div className="absolute bottom-1.5 right-1.5">
          <EmojiPicker onSelect={(emoji) => setText((prev) => prev + emoji)} />
        </div>
      </div>

      <AttachmentPicker attachments={pendingFiles} onChange={setPendingFiles} />

      <button
        type="submit"
        disabled={isDisabled}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal text-white text-xs font-medium hover:bg-[#01434A] disabled:opacity-40 transition-colors"
      >
        <Send size={11} />
        {submitting ? 'Sending…' : 'Post Comment'}
      </button>
    </form>
  );
}
