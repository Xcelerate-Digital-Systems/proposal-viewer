'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Pencil, Send, Video } from 'lucide-react';
import AttachmentPicker, { type PendingAttachment } from './AttachmentPicker';
import AttachFilesModal from './AttachFilesModal';
import EmojiPicker from './EmojiPicker';
import PrioritySelector from './PrioritySelector';
import type { FeedbackCommentAttachment } from '@/lib/supabase';
import type { FeedbackCommentPriority } from '@/lib/types/feedback';
import type { FeedbackMode } from '@/components/feedback/tools';

interface PendingPinFormProps {
  onSubmit: (content: string, attachments?: FeedbackCommentAttachment[], priority?: FeedbackCommentPriority) => Promise<void>;
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
  /** When present, shows a pencil icon that opens a drawing tool submenu. */
  onOpenDrawing?: (mode: FeedbackMode) => void;
}

const MAX_FILES = 5;

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
  onOpenDrawing,
}: PendingPinFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [priority, setPriority] = useState<FeedbackCommentPriority>('none');
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showDrawMenu, setShowDrawMenu] = useState(false);
  const drawMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDrawMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (drawMenuRef.current && !drawMenuRef.current.contains(e.target as Node)) {
        setShowDrawMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDrawMenu]);

  const isGuest = !authorName;
  const isDisabled = isGuest
    ? !text.trim() || !(guestName?.trim()) || submitting
    : !text.trim() || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);

    let attachments: FeedbackCommentAttachment[] | undefined;
    if (pendingFiles.length > 0 && companyId) {
      attachments = await uploadAttachments(pendingFiles, companyId);
    }

    await onSubmit(text, attachments, priority);
    setText('');
    setPendingFiles([]);
    setPriority('none');
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
            <AttachmentPicker attachments={pendingFiles} onChange={setPendingFiles} hideAddButton />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setShowAttachModal(true)}
          disabled={pendingFiles.length >= MAX_FILES}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed relative"
          title="Attach files"
        >
          <Paperclip size={16} />
          {pendingFiles.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-teal text-white text-[9px] font-bold flex items-center justify-center">
              {pendingFiles.length}
            </span>
          )}
        </button>
        <EmojiPicker onSelect={(emoji) => setText((prev) => prev + emoji)} />

        {onOpenDrawing && (
          <div ref={drawMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowDrawMenu((o) => !o)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Draw on page"
            >
              <Pencil size={16} />
            </button>
            {showDrawMenu && (
              <div className="absolute left-0 bottom-full mb-1 w-40 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Draw
                </p>
                {[
                  { mode: 'arrow' as const, label: 'Arrow' },
                  { mode: 'box' as const, label: 'Rectangle' },
                  { mode: 'text' as const, label: 'Text' },
                ].map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => {
                      setShowDrawMenu(false);
                      onOpenDrawing(opt.mode);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled
          className="p-1.5 rounded-lg text-gray-300 cursor-not-allowed transition-colors relative"
          title="Record video (coming soon)"
        >
          <Video size={16} />
        </button>

        <PrioritySelector value={priority} onChange={setPriority} />
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

      {showAttachModal && (
        <AttachFilesModal
          existing={pendingFiles}
          onClose={() => setShowAttachModal(false)}
          onConfirm={(files) => setPendingFiles(files)}
        />
      )}
    </form>
  );
}
