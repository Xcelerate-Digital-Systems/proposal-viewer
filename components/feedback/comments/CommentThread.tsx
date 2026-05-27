'use client';

import { useRef, useState } from 'react';
import { CornerDownRight, Send, CheckCircle2, RotateCcw, X, Check, Loader2, Type, AlignLeft } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import type { FeedbackComment } from '@/lib/supabase';
import { getCommentView, parseGoogleAdAssetView } from '@/lib/types/feedback';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import EmojiPicker from './EmojiPicker';
import AttachmentList from './AttachmentList';
import ReactionBar from './ReactionBar';
import ReplyItem from './ReplyItem';
import ThreadMenu from './ThreadMenu';
import { getPriorityDef } from './PrioritySelector';
import { useCommentReactions } from '@/hooks/useCommentReactions';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';
import CommentAvatar from './CommentAvatar';
import { Button } from '@/components/ui/Button';
import MentionEditor, { type MentionEditorHandle } from '@/components/feedback/mentions/MentionEditor';
import CommentContent from '@/components/feedback/mentions/CommentContent';

interface CommentThreadProps {
  comment: FeedbackComment;
  replies: FeedbackComment[];
  onReply: (content: string) => Promise<void>;

  // Identity — provide authorName for team members, or guestName+onNameChange for guests
  /** Team: fixed author name (skips name input in reply form) */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: callback when name changes */
  onNameChange?: (name: string) => void;

  // Resolution — provide callbacks to enable resolve/reopen buttons
  onResolve?: () => Promise<void>;
  onUnresolve?: () => Promise<void>;

  // Edit / delete
  /** Edit the top-level comment */
  onEdit?: (content: string) => Promise<void>;
  /** Delete the top-level comment (also removes replies) */
  onDelete?: () => Promise<void>;
  /** Edit a reply — receives replyId + content */
  onEditReply?: (replyId: string, content: string) => Promise<void>;
  /** Delete a reply */
  onDeleteReply?: (replyId: string) => Promise<void>;
  /** When true, every comment exposes edit/delete regardless of authorship. */
  isAdmin?: boolean;
  /** Email of the current viewer — used to detect guest-authored comments. */
  currentUserEmail?: string;
  /** Override for the display name used to detect authorship when email is absent. */
  currentUserNameOverride?: string;
  /** API endpoint that returns mentionable participants for this surface. */
  participantsUrl?: string | null;

  /** When true, show a temporary highlight ring (e.g. when scrolled to via pin click) */
  highlighted?: boolean;

  /** Map of user_id → {name, avatarUrl} for team members. When the
   *  comment's author_user_id is in the map we render their photo
   *  instead of the initial bubble. */
  memberLookup?: TeamMemberLookup;
}

export default function CommentThread({
  comment,
  replies,
  onReply,
  authorName,
  guestName,
  onNameChange,
  onResolve,
  onUnresolve,
  onEdit,
  onDelete,
  onEditReply,
  onDeleteReply,
  isAdmin = false,
  currentUserEmail,
  currentUserNameOverride,
  participantsUrl,
  highlighted = false,
  memberLookup,
}: CommentThreadProps) {
  const confirm = useConfirm();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const replyEditorRef = useRef<MentionEditorHandle | null>(null);

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim();

  const handleResolve = async () => {
    if (!onResolve || resolving) return;
    setResolving(true);
    try { await onResolve(); } finally { setResolving(false); }
  };
  const handleUnresolve = async () => {
    if (!onUnresolve || resolving) return;
    setResolving(true);
    try { await onUnresolve(); } finally { setResolving(false); }
  };

  const isGuest = !authorName;
  const replyPlain = stripHtml(replyText);
  const replyDisabled = isGuest
    ? !replyPlain || !(guestName?.trim()) || submitting
    : !replyPlain || submitting;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyDisabled) return;
    setSubmitting(true);
    await onReply(replyText);
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  const handleSaveEdit = async () => {
    const value = editText.trim();
    if (!value || value === comment.content || !stripHtml(value) || !onEdit) {
      setEditing(false);
      setEditText(comment.content);
      return;
    }
    setSavingEdit(true);
    await onEdit(value);
    setSavingEdit(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm({
      title: 'Delete comment',
      message: replies.length > 0
        ? `Delete this comment and its ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}?`
        : 'Delete this comment?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  const isTeam = comment.author_type === 'team';
  const currentUserName = (authorName ?? guestName ?? '').trim() || null;
  const identityName = (currentUserNameOverride ?? currentUserName ?? '').trim() || null;
  const identityEmail = (currentUserEmail ?? '').trim().toLowerCase() || null;

  // Admin can always modify. Guests can modify their own client comments only.
  // Match by email when present; fall back to display name.
  const ownsComment = (c: FeedbackComment) => {
    if (isAdmin) return true;
    if (c.author_type !== 'client') return false;
    const cEmail = (c.author_email ?? '').trim().toLowerCase() || null;
    if (cEmail) return !!identityEmail && cEmail === identityEmail;
    const cName = (c.author_name ?? '').trim() || null;
    return !!identityName && cName === identityName;
  };
  const canModify = ownsComment(comment);
  const { reactions, toggle: toggleReaction } = useCommentReactions(comment.id, {
    currentUserName,
  });

  return (
    <div
      data-comment-id={comment.id}
      className={`rounded-2xl bg-white px-5 py-4 shadow-card transition-all duration-300 ${
        highlighted ? 'ring-2 ring-teal ring-offset-1' : ''
      }`}
    >
      {/* Pin badge */}
      {comment.comment_type === 'pin' && comment.thread_number && (
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-semibold">
            {comment.thread_number}
          </span>
          <span className="text-[11px] text-gray-400">Pinned to content</span>
        </div>
      )}

      {/* Author + content */}
      <div className="flex items-start gap-3">
        <CommentAvatar
          authorName={comment.author_name}
          authorUserId={comment.author_user_id}
          isTeam={isTeam}
          memberLookup={memberLookup}
          className="w-8 h-8 text-xs"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink">{comment.author_name}</span>
            {isTeam && (
              <span className="text-2xs font-medium bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                Team
              </span>
            )}
            {(() => {
              // Google Search ad comments are scoped to a specific headline /
              // description. Show that asset as a chip so reviewers can read a
              // mixed comment list without losing context.
              const asset = parseGoogleAdAssetView(getCommentView(comment.annotation_data));
              if (!asset) return null;
              const Icon = asset.type === 'headline' ? Type : AlignLeft;
              const label = `${asset.type === 'headline' ? 'Headline' : 'Description'} ${asset.index + 1}`;
              return (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-blue-50 text-[#1a0dab]"
                  title={label}
                >
                  <Icon size={10} />
                  {label}
                </span>
              );
            })()}
            {comment.priority && comment.priority !== 'none' && (() => {
              const def = getPriorityDef(comment.priority);
              const Icon = def.icon;
              return (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${def.badgeClass}`}
                  title={`Priority: ${def.label}`}
                >
                  <Icon size={10} className={def.iconClass} />
                  {def.label} priority
                </span>
              );
            })()}
            <span className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</span>
          </div>
          {comment.comment_type === 'text_highlight' && comment.highlight_text && (
            <div className="mt-1.5 mb-1 px-2.5 py-1.5 rounded-lg bg-teal/5">
              <p className="text-[11px] text-teal italic line-clamp-2">&ldquo;{comment.highlight_text}&rdquo;</p>
            </div>
          )}
          {editing ? (
            <div className="mt-1 space-y-1.5">
              <div className="px-3 py-2 rounded-xl bg-[#F5F1EE] focus-within:ring-2 focus-within:ring-teal/20">
                <MentionEditor
                  value={editText}
                  onChange={setEditText}
                  participantsUrl={participantsUrl ?? null}
                  autoFocus
                  className="w-full text-[13px] text-ink"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !stripHtml(editText)}
                  loading={savingEdit}
                  leftIcon={Check}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setEditing(false); setEditText(comment.content); }}
                  disabled={savingEdit}
                  leftIcon={X}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <CommentContent
              content={comment.content}
              className="text-[13px] text-gray-700 leading-relaxed mt-1"
            />
          )}
          {comment.video_url && (
            <video
              src={comment.video_url}
              controls
              preload="metadata"
              className="mt-2 w-full max-w-[320px] rounded-lg bg-black"
            />
          )}
          <AttachmentList attachments={comment.attachments} />
          {currentUserName && (
            <div className="mt-1.5">
              <ReactionBar
                commentId={comment.id}
                reactions={reactions}
                currentUserName={currentUserName}
                onToggleReaction={(_id, emoji) => toggleReaction(emoji)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 ml-11 space-y-3">
          {replies.map((r) => (
            <ReplyItem
              key={r.id}
              reply={r}
              currentUserName={currentUserName}
              onEdit={onEditReply && ownsComment(r) ? (content) => onEditReply(r.id, content) : undefined}
              onDelete={onDeleteReply && ownsComment(r) ? () => onDeleteReply(r.id) : undefined}
              memberLookup={memberLookup}
              participantsUrl={participantsUrl}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-2 mt-3 ml-11">
          {!showReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReply(true)}
              leftIcon={CornerDownRight}
            >
              Reply
            </Button>
          )}
          {!comment.resolved && onResolve && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResolve}
              disabled={resolving || deleting}
              loading={resolving}
              leftIcon={resolving ? undefined : CheckCircle2}
            >
              {resolving ? 'Resolving…' : 'Resolve'}
            </Button>
          )}
          {comment.resolved && onUnresolve && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnresolve}
              disabled={resolving || deleting}
              loading={resolving}
              leftIcon={resolving ? undefined : RotateCcw}
            >
              {resolving ? 'Reopening…' : 'Reopen'}
            </Button>
          )}
          {deleting && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              Deleting…
            </span>
          )}
          {canModify && (onEdit || onDelete) && (
            <ThreadMenu
              align="start"
              className="ml-auto"
              onEdit={onEdit ? () => { setEditText(comment.content); setEditing(true); } : undefined}
              onDelete={onDelete ? handleDelete : undefined}
            />
          )}
        </div>
      )}

      {/* Reply form */}
      {showReply && (
        <form onSubmit={handleReply} className="mt-3 ml-11 space-y-2">
          {isGuest && !guestName && (
            <input
              type="text"
              value={guestName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-xl bg-[#F5F1EE] text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1 rounded-xl bg-[#F5F1EE] focus-within:ring-2 focus-within:ring-teal/20 px-3 py-2">
              <div className="flex-1">
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
                  apiRef={replyEditorRef}
                  className="w-full text-[13px] text-ink"
                />
              </div>
              <EmojiPicker onSelect={(emoji) => replyEditorRef.current?.insertText(emoji)} />
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
        </form>
      )}
    </div>
  );
}
