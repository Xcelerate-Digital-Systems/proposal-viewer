'use client';

import { useState, useEffect, useRef } from 'react';
import { CornerDownRight, Send, CheckCircle2, RotateCcw, Pencil, Trash2, X, Check, MoreHorizontal } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import type { FeedbackComment } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import EmojiPicker from './EmojiPicker';
import AttachmentList from './AttachmentList';
import ReactionBar from './ReactionBar';
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
    await onDelete();
  };

  const isTeam = comment.author_type === 'team';
  const currentUserName = (authorName ?? guestName ?? '').trim() || null;
  const { reactions, toggle: toggleReaction } = useCommentReactions(comment.id, {
    currentUserName,
  });

  return (
    <div
      data-comment-id={comment.id}
      className={`rounded-lg bg-gray-50 p-3 transition-all duration-300 ${
        highlighted ? 'ring-2 ring-teal ring-offset-1' : ''
      }`}
    >
      {/* Pin badge */}
      {comment.comment_type === 'pin' && comment.thread_number && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#16A34A' }}>
            {comment.thread_number}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-gray-400">Pin</span>
        </div>
      )}

      {/* Author + content */}
      <div className="flex items-start gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
          isTeam
            ? 'bg-teal/10 text-teal'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {comment.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900">{comment.author_name}</span>
            {isTeam && (
              <span className="text-[9px] font-medium uppercase bg-teal/10 text-teal px-1.5 py-0.5 rounded">
                Team
              </span>
            )}
            {comment.priority && comment.priority !== 'none' && (() => {
              const def = getPriorityDef(comment.priority);
              const Icon = def.icon;
              return (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium uppercase ${def.badgeClass}`}
                  title={`Priority: ${def.label}`}
                >
                  <Icon size={9} className={def.iconClass} />
                  {def.label}
                </span>
              );
            })()}
            <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
          </div>
          {comment.comment_type === 'text_highlight' && comment.highlight_text && (
            <div className="mt-1 mb-1 px-2 py-1.5 rounded bg-teal/5 border-l-2 border-teal/40">
              <p className="text-[10px] text-teal italic line-clamp-2">&ldquo;{comment.highlight_text}&rdquo;</p>
            </div>
          )}
          {editing ? (
            <div className="mt-1 space-y-1.5">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editText.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-teal text-white text-[10px] font-medium hover:bg-teal-hover disabled:opacity-40 transition-colors"
                >
                  <Check size={10} />
                  Save
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
            <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
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
        <div className="mt-2.5 ml-4 pl-4 border-l-2 border-gray-100 space-y-2">
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
          {!comment.resolved && onResolve && (
            <button
              onClick={onResolve}
              className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-emerald-600 transition-colors"
            >
              <CheckCircle2 size={10} />
              Resolve
            </button>
          )}
          {comment.resolved && onUnresolve && (
            <button
              onClick={onUnresolve}
              className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-600 transition-colors"
            >
              <RotateCcw size={10} />
              Reopen
            </button>
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
        <form onSubmit={handleReply} className="mt-2 ml-8 space-y-1.5">
          {isGuest && !guestName && (
            <input
              type="text"
              value={guestName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Your name"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
          )}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                autoFocus
                className="flex-1 px-2.5 py-1.5 text-[11px] text-gray-900 bg-transparent focus:outline-none"
              />
              <EmojiPicker onSelect={(emoji) => setReplyText((prev) => prev + emoji)} />
            </div>
            <button
              type="submit"
              disabled={replyDisabled}
              className="p-1.5 rounded-lg bg-teal text-white disabled:opacity-40 hover:bg-teal-hover transition-colors"
            >
              <Send size={11} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ReplyItem({
  reply,
  currentUserName,
  onEdit,
  onDelete,
}: {
  reply: FeedbackComment;
  currentUserName: string | null;
  onEdit?: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const rIsTeam = reply.author_type === 'team';
  const { reactions, toggle } = useCommentReactions(reply.id, { currentUserName });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === reply.content || !onEdit) {
      setEditing(false);
      setEditText(reply.content);
      return;
    }
    setSaving(true);
    await onEdit(trimmed);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm({
      title: 'Delete reply',
      message: 'Delete this reply?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await onDelete();
  };

  return (
    <div className="flex items-start gap-2 group">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
        rIsTeam ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'
      }`}>
        {reply.author_name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-900">{reply.author_name}</span>
          {rIsTeam && (
            <span className="text-[8px] font-medium uppercase bg-teal/10 text-teal px-1 py-0.5 rounded">
              Team
            </span>
          )}
          <span className="text-[10px] text-gray-400">{timeAgo(reply.created_at)}</span>
          {(onEdit || onDelete) && !editing && (
            <div className="ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <ThreadMenu
                align="end"
                onEdit={onEdit ? () => { setEditText(reply.content); setEditing(true); } : undefined}
                onDelete={onDelete ? handleDelete : undefined}
              />
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSave}
                disabled={saving || !editText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal text-white text-[10px] font-medium hover:bg-teal-hover disabled:opacity-40 transition-colors"
              >
                <Check size={10} />
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditText(reply.content); }}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-gray-500 text-[10px] font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <X size={10} />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{reply.content}</p>
        )}
        <AttachmentList attachments={reply.attachments} />
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

/* ─── Three-dot menu for edit/delete actions ─────────────────────── */

function ThreadMenu({
  onEdit,
  onDelete,
  align = 'end',
  className,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className ?? ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="More actions"
      >
        <MoreHorizontal size={12} />
      </button>
      {open && (
        <div
          className={`absolute z-30 top-full mt-1 ${align === 'end' ? 'right-0' : 'left-0'} bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[120px]`}
        >
          {onEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 text-left"
            >
              <Pencil size={12} className="text-gray-400" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 text-left"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
