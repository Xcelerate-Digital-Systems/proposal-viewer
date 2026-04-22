'use client';

import { useRef, useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import AttachmentPicker, { type PendingAttachment } from './AttachmentPicker';
import EmojiPicker from './EmojiPicker';
import type { FeedbackCommentAttachment } from '@/lib/supabase';

interface PendingPinFormProps {
  onSubmit: (content: string, attachments?: FeedbackCommentAttachment[]) => Promise<void>;
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

  /** Optional quoted text rendered above the textarea (used when posting from highlight mode) */
  quotedText?: string;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILES = 5;
const MAX_SIZE_MB = 10;

async function uploadAttachments(
  pending: PendingAttachment[],
  companyId: string
): Promise<FeedbackCommentAttachment[]> {
  const results: FeedbackCommentAttachment[] = [];
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
  onCancel: _onCancel,
  companyId,
  authorName,
  guestName,
  onNameChange,
  quotedText,
}: PendingPinFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGuest = !authorName;
  const isDisabled = isGuest
    ? !text.trim() || !(guestName?.trim()) || submitting
    : !text.trim() || submitting;

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_FILES - pendingFiles.length;
    if (remaining <= 0) return;
    const maxBytes = MAX_SIZE_MB * 1024 * 1024;
    const next: PendingAttachment[] = [];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (file.size > maxBytes) continue;
      const pa: PendingAttachment = { file };
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = () => {
          pa.preview = reader.result as string;
          setPendingFiles((prev) => [...prev]); // trigger re-render with populated preview
        };
        reader.readAsDataURL(file);
      }
      next.push(pa);
    }
    if (next.length > 0) setPendingFiles((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);

    let attachments: FeedbackCommentAttachment[] | undefined;
    if (pendingFiles.length > 0 && companyId) {
      attachments = await uploadAttachments(pendingFiles, companyId);
    }

    await onSubmit(text, attachments);
    setText('');
    setPendingFiles([]);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {quotedText && (
        <div className="px-4 pt-4">
          <div className="pl-2.5 py-1.5 border-l-[3px] border-yellow-300 bg-yellow-50 rounded-r">
            <p className="text-[11px] text-gray-700 italic line-clamp-3">
              &ldquo;{quotedText}&rdquo;
            </p>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        {authorName ? (
          <p className="text-[11px] text-gray-400 mb-1.5">
            Posting as <span className="font-medium text-gray-600">{authorName}</span>
          </p>
        ) : (
          <input
            type="text"
            value={guestName || ''}
            onChange={(e) => onNameChange?.(e.target.value)}
            placeholder="Your name"
            className="w-full mb-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        )}

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          rows={3}
          placeholder="Add a comment…"
          className="w-full text-[14px] text-gray-900 placeholder-gray-400 resize-none outline-none border-0 p-0 min-h-[72px] bg-transparent"
        />

        {pendingFiles.length > 0 && (
          <div className="mt-2">
            <AttachmentPicker attachments={pendingFiles} onChange={setPendingFiles} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pendingFiles.length >= MAX_FILES}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Attach file"
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          onChange={(e) => handleAddFiles(e.target.files)}
        />
        <EmojiPicker onSelect={(emoji) => setText((prev) => prev + emoji)} />
        <div className="flex-1" />
        <button
          type="submit"
          disabled={isDisabled}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-teal text-white text-[13px] font-semibold hover:bg-teal-hover disabled:opacity-40 transition-colors"
        >
          <Send size={12} />
          {submitting ? 'Sending…' : 'Post'}
        </button>
      </div>
    </form>
  );
}
