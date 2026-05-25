'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/review-utils';
import type { FeedbackComment } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useCommentReactions } from '@/hooks/useCommentReactions';
import AttachmentList from './AttachmentList';
import ReactionBar from './ReactionBar';
import ThreadMenu from './ThreadMenu';
import CommentAvatar from './CommentAvatar';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';

interface Props {
  reply: FeedbackComment;
  currentUserName: string | null;
  onEdit?: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Map of user_id → {name, avatarUrl} so team replies render the user's photo. */
  memberLookup?: TeamMemberLookup;
}

/** A single threaded reply rendered under its parent comment. */
export default function ReplyItem({ reply, currentUserName, onEdit, onDelete, memberLookup }: Props) {
  const confirm = useConfirm();
  const rIsTeam = reply.author_type === 'team';
  const { reactions, toggle } = useCommentReactions(reply.id, { currentUserName });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div className="flex items-start gap-3 group">
      <CommentAvatar
        authorName={reply.author_name}
        authorUserId={reply.author_user_id}
        isTeam={rIsTeam}
        memberLookup={memberLookup}
        className="w-7 h-7 text-[11px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{reply.author_name}</span>
          {rIsTeam && (
            <span className="text-[10px] font-medium bg-teal/10 text-teal px-2 py-0.5 rounded-full">
              Team
            </span>
          )}
          <span className="text-[11px] text-gray-400">{timeAgo(reply.created_at)}</span>
          {deleting && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Loader2 size={10} className="animate-spin" />
              Deleting…
            </span>
          )}
          {(onEdit || onDelete) && !editing && !deleting && (
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
              className="w-full px-3 py-2 rounded-xl bg-[#F5F1EE] text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSave}
                disabled={saving || !editText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal text-white text-[10px] font-medium hover:bg-teal-hover disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                {saving ? 'Saving…' : 'Save'}
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
          <p className="text-[13px] text-gray-700 leading-relaxed mt-0.5 whitespace-pre-wrap">
            {reply.content}
          </p>
        )}
        {reply.video_url && (
          <video
            src={reply.video_url}
            controls
            preload="metadata"
            className="mt-2 w-full max-w-[280px] rounded-lg bg-black"
          />
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
