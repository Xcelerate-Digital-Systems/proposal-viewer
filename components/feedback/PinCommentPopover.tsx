'use client';

import { useState, useEffect, useRef } from 'react';
import { X, CornerDownRight, Send, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import { POPOVER_STYLE, POPOVER_INLINE_STYLE } from '@/lib/feedback/popover-style';
import type { FeedbackComment, FeedbackCommentAttachment } from '@/lib/supabase';
import AttachmentList from './comments/AttachmentList';
import AttachmentPicker, { type PendingAttachment } from './comments/AttachmentPicker';
import ReactionBar from './comments/ReactionBar';
import CommentAvatar from './comments/CommentAvatar';
import { usePopoverPosition } from '@/hooks/usePopoverPosition';
import { useCommentReactions } from '@/hooks/useCommentReactions';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import MentionEditor from '@/components/feedback/mentions/MentionEditor';
import CommentContent from '@/components/feedback/mentions/CommentContent';

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
  onReply: (content: string, parentId: string, attachments?: FeedbackCommentAttachment[]) => Promise<void>;
  /** Share token for attachment uploads */
  shareToken?: string;
  /** Resolve callback */
  onResolve?: (commentId: string) => Promise<void>;
  /** Unresolve callback */
  onUnresolve?: (commentId: string) => Promise<void>;
  /** Delete callback — deletes the pin and all replies. Gated by authorship below. */
  onDelete?: (commentId: string) => Promise<void>;
  /** When true, the delete button is always shown. */
  isAdmin?: boolean;
  /** Email of the current viewer — used to detect guest-authored pins. */
  currentUserEmail?: string;
  /** Display name of the current viewer — fallback identity when no email is present. */
  currentUserName?: string;
  /** Team author name (if admin) */
  authorName?: string;
  /** Guest name (if client) */
  guestName?: string;
  /** Guest name change handler */
  onNameChange?: (name: string) => void;
  /** API endpoint returning mentionable participants for the reply editor. */
  participantsUrl?: string | null;
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
  isAdmin = false,
  currentUserEmail,
  currentUserName: currentUserNameProp,
  authorName,
  guestName,
  onNameChange,
  memberLookup,
  participantsUrl,
  shareToken,
}: PinCommentPopoverProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyFiles, setReplyFiles] = useState<PendingAttachment[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isGuest = !authorName;
  const replyPlain = replyText.replace(/<[^>]+>/g, '').trim();
  const replyDisabled = isGuest
    ? !replyPlain || !(guestName?.trim()) || submitting
    : !replyPlain || submitting;

  const currentUserName = (authorName ?? guestName ?? '').trim() || null;
  const identityName = (currentUserNameProp ?? currentUserName ?? '').trim() || null;
  const identityEmail = (currentUserEmail ?? '').trim().toLowerCase() || null;
  const commentEmail = (comment.author_email ?? '').trim().toLowerCase() || null;
  const commentName = (comment.author_name ?? '').trim() || null;
  const canDelete =
    !!onDelete &&
    (isAdmin ||
      (comment.author_type === 'client' &&
        (commentEmail
          ? !!identityEmail && identityEmail === commentEmail
          : !!identityName && identityName === commentName)));
  const {
    reactions: mainReactions,
    toggle: toggleMainReaction,
  } = useCommentReactions(comment.id, { currentUserName });

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyDisabled) return;
    setSubmitting(true);
    try {
      let uploadedAttachments: FeedbackCommentAttachment[] | undefined;
      if (replyFiles.length > 0 && shareToken) {
        uploadedAttachments = [];
        let failedCount = 0;
        for (const pa of replyFiles) {
          const formData = new FormData();
          formData.append('file', pa.file);
          formData.append('share_token', shareToken);
          const res = await fetch('/api/review-comments/attachments', { method: 'POST', body: formData });
          if (res.ok) uploadedAttachments.push(await res.json());
          else failedCount++;
        }
        if (failedCount > 0) {
          toast.error(`${failedCount} ${failedCount === 1 ? 'file' : 'files'} could not be uploaded`);
        }
      }
      await onReply(replyText, comment.id, uploadedAttachments);
      toast.success('Reply posted');
      setReplyText('');
      setReplyFiles([]);
      setShowReply(false);
      onClose();
    } finally {
      setSubmitting(false);
    }
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
        className="max-h-[520px] overflow-y-auto bg-white rounded-2xl border border-edge-strong z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold">
              {comment.thread_number || '•'}
            </span>
            <span className="text-xs text-faint">
              Pin Comment
            </span>
          </div>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>

        <div className="p-4 space-y-3">
          {/* Main comment */}
          <div className="flex items-start gap-3">
            <CommentAvatar
              authorName={comment.author_name}
              authorUserId={comment.author_user_id}
              isTeam={isTeam}
              memberLookup={memberLookup}
              className="w-8 h-8 text-xs"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{comment.author_name}</span>
                {isTeam && (
                  <span className="text-2xs font-medium uppercase bg-teal/10 text-teal px-1.5 py-0.5 rounded-full">Team</span>
                )}
                <span className="text-detail text-faint">{timeAgo(comment.created_at)}</span>
              </div>
              {comment.comment_type === 'text_highlight' && comment.highlight_text && (
                <div className="mt-1.5 mb-1 px-2.5 py-1.5 rounded-lg bg-teal/5">
                  <p className="text-detail text-teal italic line-clamp-2">&ldquo;{comment.highlight_text}&rdquo;</p>
                </div>
              )}
              <CommentContent
                content={comment.content}
                className="text-caption text-prose leading-relaxed mt-1"
              />
              <AttachmentList attachments={comment.attachments} size="sm" />

              {/* Screenshot thumbnail */}
              {comment.screenshot_url && (
                <a href={comment.screenshot_url} target="_blank" rel="noopener noreferrer"
                  className="block mt-2 w-full max-w-[220px] rounded-lg border border-edge-strong overflow-hidden hover:border-teal/40 transition-colors">
                  <img src={comment.screenshot_url} alt="Screenshot" loading="lazy" className="w-full object-cover" />
                </a>
              )}

              {/* Recorded video */}
              {comment.video_url && (
                <video
                  src={comment.video_url}
                  controls
                  preload="metadata"
                  className="mt-2 w-full max-w-[260px] rounded-lg bg-black"
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
            <div className="ml-5 pl-3 border-l-2 border-edge space-y-2.5">
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
          <div className="flex items-center gap-2 flex-wrap">
            {!showReply && (
              <Button variant="ghost" size="sm" onClick={() => setShowReply(true)} leftIcon={CornerDownRight}>
                Reply
              </Button>
            )}
            {!comment.resolved && onResolve && (
              <Button variant="ghost" size="sm" onClick={() => onResolve(comment.id)} leftIcon={CheckCircle2}>
                Resolve
              </Button>
            )}
            {comment.resolved && onUnresolve && (
              <Button variant="ghost" size="sm" onClick={() => onUnresolve(comment.id)} leftIcon={RotateCcw}>
                Reopen
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const replyCount = replies.length;
                  const ok = await confirm({
                    title: 'Delete comment',
                    message: replyCount > 0
                      ? `This will permanently remove this comment and ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}.`
                      : 'This will permanently remove this comment.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (!ok) return;
                  await onDelete!(comment.id);
                  onClose();
                }}
                leftIcon={Trash2}
                className="ml-auto text-faint hover:text-red-600"
              >
                Delete
              </Button>
            )}
          </div>

          {/* Reply form */}
          {showReply && (
            <form onSubmit={handleReply} className="space-y-2">
              {isGuest && !guestName && (
                <input type="text" value={guestName || ''} onChange={(e) => onNameChange?.(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 rounded-2xl bg-warm-dark text-caption text-ink focus:outline-none focus:ring-2 focus:ring-teal/20" />
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-2xl bg-warm-dark focus-within:ring-2 focus-within:ring-teal/20">
                  <MentionEditor
                    value={replyText}
                    onChange={setReplyText}
                    placeholder="Write a reply…"
                    autoFocus
                    submitOnEnter
                    onSubmit={() => {
                      if (replyDisabled) return;
                      handleReply({ preventDefault: () => {} } as unknown as React.FormEvent);
                    }}
                    participantsUrl={participantsUrl ?? null}
                    className="w-full text-caption text-ink"
                  />
                </div>
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
              {shareToken && (
                <AttachmentPicker attachments={replyFiles} onChange={setReplyFiles} />
              )}
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
    <div className="flex items-start gap-2.5">
      <CommentAvatar
        authorName={reply.author_name}
        authorUserId={reply.author_user_id}
        isTeam={rIsTeam}
        memberLookup={memberLookup}
        className="w-7 h-7 text-detail"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-caption font-medium text-ink">{reply.author_name}</span>
          {rIsTeam && (
            <span className="text-2xs font-medium uppercase bg-teal/10 text-teal px-1.5 py-0.5 rounded-full">Team</span>
          )}
          <span className="text-detail text-faint">{timeAgo(reply.created_at)}</span>
        </div>
        <CommentContent
          content={reply.content}
          className="text-caption text-prose leading-relaxed mt-0.5"
        />
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
