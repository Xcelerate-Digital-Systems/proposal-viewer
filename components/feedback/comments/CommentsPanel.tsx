'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import type { FeedbackComment } from '@/lib/supabase';
import GeneralCommentForm from './GeneralCommentForm';
import CommentThread from './CommentThread';
import ResolvedSection from './ResolvedSection';
import { useTeamMemberLookup } from '@/hooks/useTeamMemberLookup';

interface CommentsPanelProps {
  /** All unresolved top-level comments */
  unresolvedComments: FeedbackComment[];
  /** All resolved top-level comments */
  resolvedComments: FeedbackComment[];
  /** Get replies for a given parent comment ID */
  getReplies: (parentId: string) => FeedbackComment[];
  /** Whether there are any top-level comments at all */
  hasComments: boolean;
  /** Comment ID to scroll to and highlight (set when a pin marker is clicked) */
  highlightCommentId?: string | null;
  /** Callback to submit a (general, non-pin) comment */
  onSubmitComment: (content: string, pinX?: number, pinY?: number, parentId?: string) => Promise<void>;
  /** Callback to close the panel */
  onClose: () => void;

  // Identity — provide authorName for team members, or guestName+onNameChange for guests
  /** Team: fixed author name (skips name input) */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: callback when name changes */
  onNameChange?: (name: string) => void;

  // Resolution — provide callbacks to enable resolve/reopen buttons
  /** Resolve callback — if provided, resolve button appears on threads */
  onResolve?: (commentId: string) => Promise<void>;
  /** Unresolve callback — if provided, reopen button appears on resolved threads */
  onUnresolve?: (commentId: string) => Promise<void>;

  /** Edit callback — wired for admin always; for guests, only their own comments expose the action. */
  onEdit?: (commentId: string, content: string) => Promise<void>;
  /** Delete callback — wired for admin always; for guests, only their own comments expose the action. */
  onDelete?: (commentId: string) => Promise<void>;
  /** When true, every comment shows edit/delete regardless of authorship. */
  isAdmin?: boolean;
  /** Email of the current viewer — used to gate edit/delete to a guest's own comments. */
  currentUserEmail?: string;
  /** Display name of the current viewer — fallback identity when no email is present. */
  currentUserName?: string;

  // Attachments
  /** Public review share_token — required so uploads can prove access. */
  shareToken?: string;

  /** Desktop: static panel. Mobile: full-screen overlay. Default classes handle both. */
  className?: string;
  /** Whether the panel shows a close button. Defaults to true. */
  closable?: boolean;

  /** Override the placeholder shown on the general comment form. */
  commentPlaceholder?: string;
  /** Render the comment form expanded by default — used when the comment box
   *  is the primary feedback surface (e.g. Google Search ad assets). */
  commentFormAlwaysExpanded?: boolean;
  /** API endpoint returning mentionable participants for the comment editors. */
  participantsUrl?: string | null;

  // ── Tasks (admin-only, internal) ──
  /** Open task creation modal for a comment */
  onOpenTasks?: (commentId: string) => void;
  /** Inline quick-assign: create a task on a comment */
  onQuickAssign?: (commentId: string, memberId: string, instructions: string) => Promise<void>;
  /** Toggle task completion */
  onToggleTaskComplete?: (commentId: string, taskId: string, completed: boolean) => Promise<void>;
  /** Remove a task from a comment */
  onRemoveTask?: (commentId: string, taskId: string) => Promise<void>;
  /** Current user's team_member_id */
  currentMemberId?: string | null;
}

export default function CommentsPanel({
  unresolvedComments,
  resolvedComments,
  getReplies,
  hasComments,
  highlightCommentId,
  onSubmitComment,
  onClose,
  authorName,
  onResolve,
  onUnresolve,
  onEdit,
  onDelete,
  isAdmin = false,
  currentUserEmail,
  currentUserName: currentUserNameProp,
  guestName,
  onNameChange,
  shareToken,
  className = 'fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto lg:w-[340px] shrink-0 flex flex-col bg-warm',
  closable = true,
  commentPlaceholder,
  commentFormAlwaysExpanded,
  participantsUrl,
  onOpenTasks,
  onQuickAssign,
  onToggleTaskComplete,
  onRemoveTask,
  currentMemberId,
}: CommentsPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Avatars are looked up by share_token so guests on the public review
  // page still see real team photos (and not just initials) on team comments.
  const memberLookup = useTeamMemberLookup(shareToken);

  // Build team_member_id → name map for task badges (participants API
  // keys team members by team_member_id, unlike memberLookup which keys by
  // user_id). Only fetched when tasks are wired up.
  const [tmNameMap, setTmNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!onOpenTasks || !participantsUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { authFetch } = await import('@/lib/auth-fetch');
        const res = await authFetch(participantsUrl);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const map: Record<string, string> = {};
        for (const p of data.participants ?? []) {
          if (p.kind === 'team') map[p.id] = p.name;
        }
        if (!cancelled) setTmNameMap(map);
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, [onOpenTasks, participantsUrl]);

  // Merge team_member_id names into a lookup shape compatible with AssignmentBadge's
  // memberLookup prop (it reads .name from the lookup keyed by assigned_to).
  const assigneeLookup = useMemo(() => {
    const merged: Record<string, { name: string; avatarUrl: string | null }> = { ...memberLookup };
    for (const [tmId, name] of Object.entries(tmNameMap)) {
      if (!merged[tmId]) merged[tmId] = { name, avatarUrl: null };
    }
    return merged;
  }, [memberLookup, tmNameMap]);

  // Auto-scroll to highlighted comment when a pin marker is clicked
  useEffect(() => {
    if (!highlightCommentId || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector(
      `[data-comment-id="${highlightCommentId}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightCommentId]);

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-ink tracking-tight">Comments</h2>
          {(unresolvedComments.length > 0 || resolvedComments.length > 0) && (
            <p className="text-detail text-faint mt-0.5">
              {unresolvedComments.length} open
              {resolvedComments.length > 0 && ` · ${resolvedComments.length} resolved`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded text-faint hover:text-prose transition-colors ${closable ? '' : 'lg:hidden'}`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Threads */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Unresolved threads */}
        {unresolvedComments.map((c) => (
          <CommentThread
            key={c.id}
            comment={c}
            replies={getReplies(c.id)}
            authorName={authorName}
            guestName={guestName}
            onNameChange={onNameChange}
            onReply={async (content) => {
              await onSubmitComment(content, undefined, undefined, c.id);
            }}
            onResolve={onResolve ? () => onResolve(c.id) : undefined}
            onUnresolve={onUnresolve ? () => onUnresolve(c.id) : undefined}
            onEdit={onEdit ? (content) => onEdit(c.id, content) : undefined}
            onDelete={onDelete ? () => onDelete(c.id) : undefined}
            onEditReply={onEdit}
            onDeleteReply={onDelete}
            isAdmin={isAdmin}
            currentUserEmail={currentUserEmail}
            currentUserNameOverride={currentUserNameProp}
            participantsUrl={participantsUrl}
            shareToken={shareToken}
            highlighted={highlightCommentId === c.id}
            memberLookup={memberLookup}
            onOpenTasks={onOpenTasks ? () => onOpenTasks(c.id) : undefined}
            onQuickAssign={onQuickAssign ? (memberId, instructions) => onQuickAssign(c.id, memberId, instructions) : undefined}
            onToggleTaskComplete={onToggleTaskComplete ? (taskId, completed) => onToggleTaskComplete(c.id, taskId, completed) : undefined}
            onRemoveTask={onRemoveTask ? (taskId) => onRemoveTask(c.id, taskId) : undefined}
            currentMemberId={currentMemberId}
            assigneeLookup={assigneeLookup}
          />
        ))}

        {/* Resolved */}
        <ResolvedSection
          comments={resolvedComments}
          getReplies={getReplies}
          onUnresolve={onUnresolve}
          memberLookup={memberLookup}
        />

        {/* Empty state */}
        {!hasComments && (
          <div className="text-center py-12">
            <MapPin size={28} className="mx-auto mb-3 text-gray-300" />
            <p className="text-caption text-faint">
              Click anywhere on the content to leave a comment.
            </p>
          </div>
        )}
      </div>

      {/* General comment form */}
      <GeneralCommentForm
        authorName={authorName}
        guestName={guestName}
        onNameChange={onNameChange}
        shareToken={shareToken}
        placeholder={commentPlaceholder}
        alwaysExpanded={commentFormAlwaysExpanded}
        participantsUrl={participantsUrl}
        // Reset internal state when the placeholder changes so switching
        // assets (Headline 1 → Headline 2) re-renders the form fresh.
        key={commentPlaceholder ?? 'default'}
        onSubmit={async (content) => {
          await onSubmitComment(content);
        }}
      />
    </div>
  );
}
