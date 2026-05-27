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
import MentionEditor from '@/components/feedback/mentions/MentionEditor';
import CommentContent from '@/components/feedback/mentions/CommentContent';

interface Props {
  reply: FeedbackComment;
  currentUserName: string | null;
  onEdit?: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Map of user_id → {name, avatarUrl} so team replies render the user's photo. */
  memberLookup?: TeamMemberLookup;
  /** API endpoint returning mentionable participants for the edit-in-place editor. */
  participantsUrl?: string | null;
}

/** A single threaded reply rendered under its parent comment. */
export default function ReplyItem({ reply, currentUserName, onEdit, onDelete, memberLookup, participantsUrl }: Props) {
  const confirm = useConfirm();
  const rIsTeam = reply.author_type === 'team';
  const { reactions, toggle } = useCommentReactions(reply.id, { currentUserName });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim();

  const handleSave = async () => {
    const value = editText.trim();
    if (!value || value === reply.content || !stripHtml(value) || !onEdit) {
      setEditing(false);
      setEditText(reply.content);
      return;
    }
    setSaving(true);
    await onEdit(value);
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
        className="w-7 h-7 text-detail"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-caption font-medium text-ink">{reply.author_name}</span>
          {rIsTeam && (
            <span className="text-2xs font-medium bg-teal/10 text-teal px-2 py-0.5 rounded-full">
              Team
            </span>
          )}
          <span className="text-detail text-faint">{timeAgo(reply.created_at)}</span>
          {deleting && (
            <span className="flex items-center gap-1 text-detail text-faint">
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
            <div className="px-3 py-2 rounded-2xl bg-warm-dark focus-within:ring-2 focus-within:ring-teal/20">
              <MentionEditor
                value={editText}
                onChange={setEditText}
                participantsUrl={participantsUrl ?? null}
                autoFocus
                className="w-full text-caption text-ink"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSave}
                disabled={saving || !stripHtml(editText)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal text-white text-2xs font-medium hover:bg-teal-hover disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditText(reply.content); }}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-edge-strong text-dim text-2xs font-medium hover:bg-surface disabled:opacity-40 transition-colors"
              >
                <X size={10} />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <CommentContent
            content={reply.content}
            className="text-caption text-prose leading-relaxed mt-0.5"
          />
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
