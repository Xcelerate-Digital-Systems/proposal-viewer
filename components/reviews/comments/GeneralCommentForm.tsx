// components/reviews/comments/GeneralCommentForm.tsx
'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

interface GeneralCommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  /** 'admin' = authorName label, 'client' = guest name input */
  variant: 'admin' | 'client';
  /** Required for admin — displayed as "Posting as {authorName}" */
  authorName?: string;
  /** Required for client — editable guest name */
  guestName?: string;
  /** Required for client — callback when guest name changes */
  onNameChange?: (name: string) => void;
}

export default function GeneralCommentForm({
  onSubmit,
  variant,
  authorName,
  guestName,
  onNameChange,
}: GeneralCommentFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isDisabled = variant === 'client'
    ? !text.trim() || !(guestName?.trim()) || submitting
    : !text.trim() || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);
    await onSubmit(text);
    setText('');
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
          {variant === 'admin' ? (
            <p className="text-[10px] text-gray-400">Posting as {authorName}</p>
          ) : (
            <input
              type="text"
              value={guestName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Your name"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
            />
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Your comment…"
            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDisabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#017C87] text-white text-xs font-medium hover:bg-[#01434A] disabled:opacity-40 transition-colors"
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