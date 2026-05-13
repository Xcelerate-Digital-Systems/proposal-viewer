'use client';

import { useState } from 'react';
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

  // Edit / delete (team-only)
  /** Edit the top-level comment */
  onEdit?: (content: string) => Promise<void>;
  /** Delete the top-level comment (also removes replies) */
  onDelete?: () => Promise<void>;
  /** Edit a reply — receives replyId + content */
  onEditReply?: (replyId: string, content: string) => Promise<void>;
  /** Delete a reply */
  onDeleteReply?: (replyId: string) => Promise<void>;

  /** When true, show a temporary highlight ring (e.g. when scrolled to via pin click) */
  highlighted?: boolean;
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
  highlighted = false,
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
  const replyDisabled = isGuest
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

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.content || !onEdit) {
      setEditing(false);
      setEditText(comment.content);
      return;
    }
    setSavingEdit(true);
    await onEdit(trimmed);
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
  const { reactions, toggle: toggleReaction } = useCommentReactions(comment.id, {
    currentUserName,
  });

  return (
    <div
      data-comment-id={comment.id}
      className={`rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.03)] transition-all duration-300 ${
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
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold ${
          isTeam
            ? 'bg-teal/10 text-teal'
            : 'bg-violet-100 text-violet-700'
        }`}>
          {comment.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink">{comment.author_name}</span>
            {isTeam && (
              <span className="text-[10px] font-medium bg-teal/10 text-teal px-2 py-0.5 rounded-full">
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-[#1a0dab]"
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
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F1EE] text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editText.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-teal text-white text-[10px] font-medium hover:bg-teal-hover disabled:opacity-40 transition-colors"
                >
                  {savingEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditText(comment.content); }}
                  disabled={savingEdit}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-500 text-[10px] font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <X size={10} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-gray-700 leading-relaxed mt-1 whitespace-pre-wrap">{comment.content}</p>
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
              onEdit={onEditReply ? (content) => onEditReply(r.id, content) : undefined}
              onDelete={onDeleteReply ? () => onDeleteReply(r.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-4 mt-3 ml-11">
          {!showReply && (
            <button
              onClick={() => setShowReply(true)}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-ink transition-colors"
            >
              <CornerDownRight size={12} />
              Reply
            </button>
          )}
          {!comment.resolved && onResolve && (
            <button
              onClick={handleResolve}
              disabled={resolving || deleting}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
            >
              {resolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              {resolving ? 'Resolving…' : 'Resolve'}
            </button>
          )}
          {comment.resolved && onUnresolve && (
            <button
              onClick={handleUnresolve}
              disabled={resolving || deleting}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50"
            >
              {resolving ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              {resolving ? 'Reopening…' : 'Reopen'}
            </button>
          )}
          {deleting && (
            <span className="flex items-center gap-1 text-[12px] text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              Deleting…
            </span>
          )}
          {(onEdit || onDelete) && (
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
            <div className="flex-1 flex items-center gap-1 rounded-xl bg-[#F5F1EE] focus-within:ring-2 focus-within:ring-teal/20">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                autoFocus
                className="flex-1 px-3 py-2 text-[13px] text-ink bg-transparent focus:outline-none"
              />
              <EmojiPicker onSelect={(emoji) => setReplyText((prev) => prev + emoji)} />
            </div>
            <button
              type="submit"
              disabled={replyDisabled}
              className="w-8 h-8 rounded-full bg-teal text-white inline-flex items-center justify-center disabled:opacity-40 hover:bg-teal-hover transition-colors"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
