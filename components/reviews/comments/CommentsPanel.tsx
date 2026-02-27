// components/reviews/comments/CommentsPanel.tsx
'use client';

import { MapPin, X } from 'lucide-react';
import type { ReviewComment } from '@/lib/supabase';
import PendingPinForm from './PendingPinForm';
import GeneralCommentForm from './GeneralCommentForm';
import CommentThread from './CommentThread';
import ResolvedSection from './ResolvedSection';

interface CommentsPanelProps {
  /** All unresolved top-level comments */
  unresolvedComments: ReviewComment[];
  /** All resolved top-level comments */
  resolvedComments: ReviewComment[];
  /** Get replies for a given parent comment ID */
  getReplies: (parentId: string) => ReviewComment[];
  /** Whether there are any top-level comments at all */
  hasComments: boolean;
  /** Currently placing a new pin */
  pendingPin: { x: number; y: number } | null;
  /** Callback to submit a comment */
  onSubmitComment: (content: string, pinX?: number, pinY?: number, parentId?: string) => Promise<void>;
  /** Callback to cancel pending pin */
  onCancelPin: () => void;
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

  /** Desktop: static panel. Mobile: full-screen overlay. Default classes handle both. */
  className?: string;
  /** Whether the panel shows a close button. Defaults to true. */
  closable?: boolean;
}

export default function CommentsPanel({
  unresolvedComments,
  resolvedComments,
  getReplies,
  hasComments,
  pendingPin,
  onSubmitComment,
  onCancelPin,
  onClose,
  authorName,
  onResolve,
  onUnresolve,
  guestName,
  onNameChange,
  className = 'fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto lg:w-[340px] shrink-0 flex flex-col border-l border-gray-200 bg-white',
  closable = true,
}: CommentsPanelProps) {
  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div>
          <span className="text-sm font-semibold text-gray-900">Comments</span>
          {unresolvedComments.length > 0 && (
            <span className="ml-1.5 text-xs text-gray-400">
              ({unresolvedComments.length} open)
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded text-gray-400 hover:text-gray-600 transition-colors ${closable ? '' : 'lg:hidden'}`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Threads */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Pending pin form */}
        {pendingPin && (
          <PendingPinForm
            authorName={authorName}
            guestName={guestName}
            onNameChange={onNameChange}
            onSubmit={async (content) => {
              await onSubmitComment(content, pendingPin.x, pendingPin.y);
            }}
            onCancel={onCancelPin}
          />
        )}

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
          />
        ))}

        {/* Resolved */}
        <ResolvedSection
          comments={resolvedComments}
          getReplies={getReplies}
          onUnresolve={onUnresolve}
        />

        {/* Empty state */}
        {!hasComments && !pendingPin && (
          <div className="text-center py-8">
            <MapPin size={24} className="mx-auto mb-2 text-gray-200" />
            <p className="text-xs text-gray-400">
              Use the pin tool to place feedback on the content, or leave a general comment below.
            </p>
          </div>
        )}
      </div>

      {/* General comment form */}
      <GeneralCommentForm
        authorName={authorName}
        guestName={guestName}
        onNameChange={onNameChange}
        onSubmit={async (content) => {
          await onSubmitComment(content);
        }}
      />
    </div>
  );
}