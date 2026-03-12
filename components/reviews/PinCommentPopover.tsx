// components/reviews/PinCommentPopover.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, CornerDownRight, Send, CheckCircle2, RotateCcw, ExternalLink, FileText } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import type { ReviewComment, ReviewCommentAttachment } from '@/lib/supabase';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function AttachmentList({ attachments }: { attachments?: ReviewCommentAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((a, i) => {
        const isImage = IMAGE_TYPES.includes(a.type);
        return isImage ? (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
            className="block w-14 h-14 rounded-lg border border-gray-200 overflow-hidden hover:border-teal/40 transition-colors">
            <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
          </a>
        ) : (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 hover:border-teal/40 transition-colors">
            <FileText size={10} className="text-gray-400 shrink-0" />
            <span className="text-[10px] text-gray-600 truncate max-w-[80px]">{a.name}</span>
            <ExternalLink size={8} className="text-gray-300 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

interface PinCommentPopoverProps {
  /** The parent comment for this pin */
  comment: ReviewComment;
  /** Replies to this comment */
  replies: ReviewComment[];
  /** Pin position as percentages */
  pinX: number;
  pinY: number;
  /** Container element for positioning */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Close the popover */
  onClose: () => void;
  /** Submit a reply */
  onReply: (content: string, parentId: string) => Promise<void>;
  /** Resolve callback */
  onResolve?: (commentId: string) => Promise<void>;
  /** Unresolve callback */
  onUnresolve?: (commentId: string) => Promise<void>;
  /** Team author name (if admin) */
  authorName?: string;
  /** Guest name (if client) */
  guestName?: string;
  /** Guest name change handler */
  onNameChange?: (name: string) => void;
}

export default function PinCommentPopover({
  comment,
  replies,
  pinX,
  pinY,
  containerRef,
  onClose,
  onReply,
  onResolve,
  onUnresolve,
  authorName,
  guestName,
  onNameChange,
}: PinCommentPopoverProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isGuest = !authorName;
  const replyDisabled = isGuest
    ? !replyText.trim() || !(guestName?.trim()) || submitting
    : !replyText.trim() || submitting;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyDisabled) return;
    setSubmitting(true);
    await onReply(replyText, comment.id);
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Position the popover relative to the container
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
  };

  // Place to the right of the pin if there's room, otherwise to the left
  if (pinX < 60) {
    style.left = `calc(${pinX}% + 20px)`;
  } else {
    style.right = `calc(${100 - pinX}% + 20px)`;
  }

  // Vertically centered near the pin
  if (pinY < 40) {
    style.top = `${pinY}%`;
  } else if (pinY > 60) {
    style.bottom = `${100 - pinY}%`;
  } else {
    style.top = `${pinY}%`;
    style.transform = 'translateY(-50%)';
  }

  const isTeam = comment.author_type === 'team';

  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={popoverRef}
        style={style}
        className="w-[300px] max-h-[400px] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">
              {comment.thread_number || '•'}
            </span>
            <span className="text-[10px] text-gray-400">
              Pin Comment
            </span>
          </div>
          <button onClick={onClose} className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={12} />
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {/* Main comment */}
          <div className="flex items-start gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
              isTeam ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'
            }`}>
              {comment.author_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900">{comment.author_name}</span>
                {isTeam && (
                  <span className="text-[9px] font-medium uppercase bg-teal/10 text-teal px-1.5 py-0.5 rounded">Team</span>
                )}
                <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
              </div>
              {comment.comment_type === 'text_highlight' && comment.highlight_text && (
                <div className="mt-1 mb-1 px-2 py-1.5 rounded bg-yellow-50 border-l-2 border-yellow-300">
                  <p className="text-[10px] text-yellow-700 italic line-clamp-2">&ldquo;{comment.highlight_text}&rdquo;</p>
                </div>
              )}
              <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
              <AttachmentList attachments={comment.attachments} />

              {/* Screenshot thumbnail */}
              {comment.screenshot_url && (
                <a href={comment.screenshot_url} target="_blank" rel="noopener noreferrer"
                  className="block mt-1.5 w-full max-w-[200px] rounded-lg border border-gray-200 overflow-hidden hover:border-teal/40 transition-colors">
                  <img src={comment.screenshot_url} alt="Screenshot" className="w-full object-cover" />
                </a>
              )}
            </div>
          </div>

          {/* Replies */}
          {replies.length > 0 && (
            <div className="ml-4 pl-3 border-l-2 border-gray-100 space-y-2">
              {replies.map((r) => {
                const rIsTeam = r.author_type === 'team';
                return (
                  <div key={r.id} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                      rIsTeam ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {r.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-gray-900">{r.author_name}</span>
                        {rIsTeam && (
                          <span className="text-[8px] font-medium uppercase bg-teal/10 text-teal px-1 py-0.5 rounded">Team</span>
                        )}
                        <span className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{r.content}</p>
                      <AttachmentList attachments={r.attachments} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            {!showReply && (
              <button onClick={() => setShowReply(true)}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
                <CornerDownRight size={10} />
                Reply
              </button>
            )}
            {!comment.resolved && onResolve && (
              <button onClick={() => onResolve(comment.id)}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-emerald-600 transition-colors">
                <CheckCircle2 size={10} />
                Resolve
              </button>
            )}
            {comment.resolved && onUnresolve && (
              <button onClick={() => onUnresolve(comment.id)}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-600 transition-colors">
                <RotateCcw size={10} />
                Reopen
              </button>
            )}
          </div>

          {/* Reply form */}
          {showReply && (
            <form onSubmit={handleReply} className="space-y-1.5">
              {isGuest && !guestName && (
                <input type="text" value={guestName || ''} onChange={(e) => onNameChange?.(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal" />
              )}
              <div className="flex gap-1.5">
                <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply…" autoFocus
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal" />
                <button type="submit" disabled={replyDisabled}
                  className="p-1.5 rounded-lg bg-teal text-white disabled:opacity-40 hover:bg-[#01434A] transition-colors">
                  <Send size={11} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
