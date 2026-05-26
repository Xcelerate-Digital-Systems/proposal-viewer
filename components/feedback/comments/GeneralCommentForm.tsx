'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import AttachmentPicker, { type PendingAttachment } from './AttachmentPicker';
import EmojiPicker from './EmojiPicker';
import type { FeedbackCommentAttachment } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

interface GeneralCommentFormProps {
  onSubmit: (content: string, attachments?: FeedbackCommentAttachment[]) => Promise<void>;
  /** Public review share_token — proof-of-access for attachment uploads. */
  shareToken?: string;

  // Identity — provide authorName for team, or guestName+onNameChange for guests
  /** Team: fixed author name — displayed as "Posting as {authorName}" */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: callback when name changes */
  onNameChange?: (name: string) => void;

  /** Placeholder shown on the collapsed pill and the expanded textarea.
   *  Defaults to "Leave feedback…" so the affordance reads as an invitation
   *  rather than a generic comment box. */
  placeholder?: string;
  /** Render the form expanded by default and skip the cancel/collapse step —
   *  used for content types (e.g. Google Search ads) where the comment box is
   *  the primary feedback surface. */
  alwaysExpanded?: boolean;
}

async function uploadAttachments(
  pending: PendingAttachment[],
  shareToken: string
): Promise<FeedbackCommentAttachment[]> {
  const results: FeedbackCommentAttachment[] = [];
  for (const pa of pending) {
    const formData = new FormData();
    formData.append('file', pa.file);
    formData.append('share_token', shareToken);

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
  shareToken,
  authorName,
  guestName,
  onNameChange,
  placeholder = 'Leave feedback…',
  alwaysExpanded = false,
}: GeneralCommentFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  const isGuest = !authorName;
  const isDisabled = isGuest
    ? !text.trim() || !(guestName?.trim()) || submitting
    : !text.trim() || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);

    let attachments: FeedbackCommentAttachment[] | undefined;
    if (pendingFiles.length > 0 && shareToken) {
      attachments = await uploadAttachments(pendingFiles, shareToken);
    }

    await onSubmit(text, attachments);
    setText('');
    setPendingFiles([]);
    setSubmitting(false);
    if (!alwaysExpanded) setExpanded(false);
  };

  return (
    <div className="px-4 pt-3 pb-5 shrink-0">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left px-4 py-3 rounded-2xl text-[13px] text-gray-400 bg-white shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.03)] hover:text-gray-600 transition-colors"
        >
          {placeholder}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.03)] px-4 py-3 space-y-2">
          {authorName ? (
            <p className="text-[11px] text-gray-400">Posting as {authorName}</p>
          ) : (
            <input
              type="text"
              value={guestName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-xl bg-[#F5F1EE] text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          )}

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              autoFocus={!alwaysExpanded}
              placeholder={placeholder}
              className="w-full px-0 py-1 pr-8 text-[13px] text-ink placeholder:text-gray-400 bg-transparent resize-none focus:outline-none leading-relaxed"
            />
            <div className="absolute bottom-1 right-0">
              <EmojiPicker onSelect={(emoji) => setText((prev) => prev + emoji)} />
            </div>
          </div>

          <AttachmentPicker attachments={pendingFiles} onChange={setPendingFiles} />

          <div className="flex items-center justify-end gap-2">
            {!alwaysExpanded && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setExpanded(false); setPendingFiles([]); }}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isDisabled}
              leftIcon={Send}
            >
              Post
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
