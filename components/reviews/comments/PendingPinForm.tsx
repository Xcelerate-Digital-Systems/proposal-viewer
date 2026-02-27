// components/reviews/comments/PendingPinForm.tsx
'use client';

import { useState } from 'react';
import { MapPin, Send, X } from 'lucide-react';

interface PendingPinFormProps {
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;

  // Identity — provide authorName for team, or guestName+onNameChange for guests
  /** Team: fixed author name — displayed as "Posting as {authorName}" */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: callback when name changes */
  onNameChange?: (name: string) => void;
}

export default function PendingPinForm({
  onSubmit,
  onCancel,
  authorName,
  guestName,
  onNameChange,
}: PendingPinFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isGuest = !authorName;
  const isDisabled = isGuest
    ? !text.trim() || !(guestName?.trim()) || submitting
    : !text.trim() || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);
    await onSubmit(text);
    setText('');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#017C87]/30 bg-[#017C87]/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-[#017C87]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#017C87]">
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
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
        />
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Describe your feedback…"
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
      />

      <button
        type="submit"
        disabled={isDisabled}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#017C87] text-white text-xs font-medium hover:bg-[#01434A] disabled:opacity-40 transition-colors"
      >
        <Send size={11} />
        {submitting ? 'Sending…' : 'Post Comment'}
      </button>
    </form>
  );
}