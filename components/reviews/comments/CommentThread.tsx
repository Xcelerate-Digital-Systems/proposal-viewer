// components/reviews/comments/CommentThread.tsx
'use client';

import { useState } from 'react';
import { CornerDownRight, Send, CheckCircle2, RotateCcw } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import type { ReviewComment } from '@/lib/supabase';

interface CommentThreadProps {
  comment: ReviewComment;
  replies: ReviewComment[];
  onReply: (content: string) => Promise<void>;
  /** 'admin' = resolve buttons + team badges, 'client' = guest name input */
  variant: 'admin' | 'client';
  /** Admin: fixed author name */
  authorName?: string;
  /** Client: editable guest name */
  guestName?: string;
  /** Client: callback when guest name changes */
  onNameChange?: (name: string) => void;
  /** Admin: resolve callback */
  onResolve?: () => Promise<void>;
  /** Admin: unresolve callback */
  onUnresolve?: () => Promise<void>;
}

export default function CommentThread({
  comment,
  replies,
  onReply,
  variant,
  authorName,
  guestName,
  onNameChange,
  onResolve,
  onUnresolve,
}: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const replyDisabled = variant === 'client'
    ? !replyText.trim() || !(guestName?.trim()) || submitting
    : !replyText.trim() || submitting;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyDisabled) return;
    setSubmitting(true);
    await onReply(replyText);
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  const isTeam = comment.author_type === 'team';

  return (
    <div className={variant === 'admin' ? 'rounded-lg border border-gray-200 p-3' : 'rounded-lg bg-gray-50 p-3'}>
      {/* Pin badge */}
      {comment.comment_type === 'pin' && comment.thread_number && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-5 h-5 rounded-full bg-[#017C87] text-white flex items-center justify-center text-[10px] font-bold">
            {comment.thread_number}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-gray-400">Pin</span>
        </div>
      )}

      {/* Author + content */}
      <div className="flex items-start gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
          variant === 'admin' && isTeam
            ? 'bg-[#017C87]/10 text-[#017C87]'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {comment.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900">{comment.author_name}</span>
            {variant === 'admin' && isTeam && (
              <span className="text-[9px] font-medium uppercase bg-[#017C87]/10 text-[#017C87] px-1.5 py-0.5 rounded">
                Team
              </span>
            )}
            <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-2.5 ml-4 pl-4 border-l-2 border-gray-100 space-y-2">
          {replies.map((r) => {
            const rIsTeam = r.author_type === 'team';
            return (
              <div key={r.id} className="flex items-start gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                  variant === 'admin' && rIsTeam
                    ? 'bg-[#017C87]/10 text-[#017C87]'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {r.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-900">{r.author_name}</span>
                    {variant === 'admin' && rIsTeam && (
                      <span className="text-[8px] font-medium uppercase bg-[#017C87]/10 text-[#017C87] px-1 py-0.5 rounded">
                        Team
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{r.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-2.5 ml-8">
        {!showReply && (
          <button
            onClick={() => setShowReply(true)}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CornerDownRight size={10} />
            Reply
          </button>
        )}
        {variant === 'admin' && (
          <>
            {!comment.resolved ? (
              <button
                onClick={onResolve}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-emerald-600 transition-colors"
              >
                <CheckCircle2 size={10} />
                Resolve
              </button>
            ) : (
              <button
                onClick={onUnresolve}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-600 transition-colors"
              >
                <RotateCcw size={10} />
                Reopen
              </button>
            )}
          </>
        )}
      </div>

      {/* Reply form */}
      {showReply && (
        <form onSubmit={handleReply} className="mt-2 ml-8 space-y-1.5">
          {variant === 'client' && !guestName && (
            <input
              type="text"
              value={guestName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Your name"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
            />
          )}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              autoFocus
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
            />
            <button
              type="submit"
              disabled={replyDisabled}
              className="p-1.5 rounded-lg bg-[#017C87] text-white disabled:opacity-40 hover:bg-[#01434A] transition-colors"
            >
              <Send size={11} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}