'use client';

import { useState, useEffect, useRef } from 'react';
import { X, CornerDownRight, Send, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import { POPOVER_STYLE, POPOVER_INLINE_STYLE } from '@/lib/feedback/popover-style';
import type { FeedbackComment } from '@/lib/supabase';
import AttachmentList from './comments/AttachmentList';
import ReactionBar from './comments/ReactionBar';
import CommentAvatar from './comments/CommentAvatar';
import { usePopoverPosition } from '@/hooks/usePopoverPosition';
import { useCommentReactions } from '@/hooks/useCommentReactions';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';
import { Button } from '@/components/ui/Button';

interface PinCommentPopoverProps {
  /** The parent comment for this pin */
  comment: FeedbackComment;
  /** Replies to this comment */
  replies: FeedbackComment[];
  /** Pin position as percentages */
  pinX: number;
  pinY: number;
  /** Container element for positioning */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Close the popover */
  onClose: () => void;
  /** Submit a reply */
  onReply: (content: string, parentId: string) => Promise<void>;
  /** Resolve callback */
  onResolve?: (commentId: string) => Promise<void>;
  /** Unresolve callback */
  onUnresolve?: (commentId: string) => Promise<void>;
  /** Delete callback (admin only — deletes the pin and all replies) */
  onDelete?: (commentId: string) => Promise<void>;
  /** Team author name (if admin) */
  authorName?: string;
  /** Guest name (if client) */
  guestName?: string;
  /** Guest name change handler */
  onNameChange?: (name: string) => void;
  /** Map of user_id → {name, avatarUrl} for team members. When the comment's
   *  author_user_id is in the map we render their photo instead of the
   *  initial bubble — mirrors CommentThread / ReplyItem. */
  memberLookup?: TeamMemberLookup;
}

export default function PinCommentPopover({
  comment,
  replies,
  pinX,
  pinY,
  onClose,
  onReply,
  onResolve,
  onUnresolve,
  onDelete,
  authorName,
  guestName,
  onNameChange,
  memberLookup,
}: PinCommentPopoverProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isGuest = !authorName;
  const replyDisabled = isGuest
    ? !replyText.trim() || !(guestName?.trim()) || submitting
    : !replyText.trim() || submitting;

  const currentUserName = (authorName ?? guestName ?? '').trim() || null;
  const {
    reactions: mainReactions,
    toggle: toggleMainReaction,
  } = useCommentReactions(comment.id, { currentUserName });

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyDisabled) return;
    setSubmitting(true);
    await onReply(replyText, comment.id);
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const style = usePopoverPosition(pinX, pinY);
  const isTeam = comment.author_type === 'team';

  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={popoverRef}
        style={{ ...style, width: POPOVER_STYLE.widthPx, ...POPOVER_INLINE_STYLE }}
        className="max-h-[440px] overflow-y-auto bg-white rounded-xl border border-gray-200 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-[10px] font-bold">
              {comment.thread_number || '•'}
            </span>
            <span className="text-[10px] text-gray-400">
              Pin Comment
            </span>
          </div>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>

        <div className="p-3 space-y-2.5">
          {/* Main comment */}
          <div className="flex items-start gap-2">
            <CommentAvatar
              authorName={comment.author_name}
              authorUserId={comment.author_user_id}
              isTeam={isTeam}
              memberLookup={memberLookup}
              className="w-6 h-6 text-[10px]"
            />
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
              <AttachmentList attachments={comment.attachments} size="sm" />

              {/* Screenshot thumbnail */}
              {comment.screenshot_url && (
                <a href={comment.screenshot_url} target="_blank" rel="noopener noreferrer"
                  className="block mt-1.5 w-full max-w-[200px] rounded-lg border border-gray-200 overflow-hidden hover:border-teal/40 transition-colors">
                  <img src={comment.screenshot_url} alt="Screenshot" className="w-full object-cover" />
                </a>
              )}

              {/* Recorded video */}
              {comment.video_url && (
                <video
                  src={comment.video_url}
                  controls
                  preload="metadata"
                  className="mt-1.5 w-full max-w-[240px] rounded-lg bg-black"
                />
              )}

              {currentUserName && (
                <div className="mt-1.5">
                  <ReactionBar
                    commentId={comment.id}
                    reactions={mainReactions}
                    currentUserName={currentUserName}
                    onToggleReaction={(_id, emoji) => toggleMainReaction(emoji)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Replies */}
          {replies.length > 0 && (
            <div className="ml-4 pl-3 border-l-2 border-gray-100 space-y-2">
              {replies.map((r) => (
                <PopoverReplyItem
                  key={r.id}
                  reply={r}
                  currentUserName={currentUserName}
                  memberLookup={memberLookup}
                />
              ))}
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
            {onDelete && (
              <button
                onClick={async () => {
                  await onDelete(comment.id);
                  onClose();
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-red-600 transition-colors ml-auto">
                <Trash2 size={10} />
                Delete
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
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={replyDisabled}
                  loading={submitting}
                  iconOnly
                  leftIcon={Send}
                  aria-label="Send reply"
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function PopoverReplyItem({
  reply,
  currentUserName,
  memberLookup,
}: {
  reply: FeedbackComment;
  currentUserName: string | null;
  memberLookup?: TeamMemberLookup;
}) {
  const rIsTeam = reply.author_type === 'team';
  const { reactions, toggle } = useCommentReactions(reply.id, { currentUserName });

  return (
    <div className="flex items-start gap-2">
      <CommentAvatar
        authorName={reply.author_name}
        authorUserId={reply.author_user_id}
        isTeam={rIsTeam}
        memberLookup={memberLookup}
        className="w-5 h-5 text-[9px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-900">{reply.author_name}</span>
          {rIsTeam && (
            <span className="text-[8px] font-medium uppercase bg-teal/10 text-teal px-1 py-0.5 rounded">Team</span>
          )}
          <span className="text-[10px] text-gray-400">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{reply.content}</p>
        <AttachmentList attachments={reply.attachments} size="sm" />
        {currentUserName && (
          <div className="mt-1.5">
            <ReactionBar
              commentId={reply.id}
              reactions={reactions}
              currentUserName={currentUserName}
              onToggleReaction={(_id, emoji) => toggle(emoji)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
