'use client';

import { CheckCircle2, ExternalLink, MessageSquare, RotateCcw } from 'lucide-react';
import { getPriorityDef } from '@/components/feedback/comments/PrioritySelector';
import { formatTimeAgo } from '@/lib/review-utils';
import { TYPE_ICONS, type CommentWithItem } from './types';

interface Props {
  comment: CommentWithItem;
  /** Open the detail modal */
  onSelect: () => void;
  /** Navigate to the source item viewer */
  onViewItem: () => void;
  /** Toggle resolved state from the row */
  onToggleResolve: () => void;
}

export default function FeedbackRow({
  comment,
  onSelect,
  onViewItem,
  onToggleResolve,
}: Props) {
  const TypeIcon = TYPE_ICONS[comment.item_type] || MessageSquare;
  const priorityDef =
    comment.priority && comment.priority !== 'none' ? getPriorityDef(comment.priority) : null;
  const PriorityIcon = priorityDef?.icon;

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-surface transition-colors cursor-pointer"
    >
      {/* Thread number badge */}
      <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
        {comment.thread_number ? (
          <span className="text-xs font-bold text-teal">#{comment.thread_number}</span>
        ) : (
          <MessageSquare size={14} className="text-teal" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="text-sm text-ink line-clamp-2 leading-relaxed flex-1">
            {comment.content}
          </p>
          {priorityDef && PriorityIcon && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-detail font-medium shrink-0 ${priorityDef.badgeClass}`}
              title={`Priority: ${priorityDef.label}`}
            >
              <PriorityIcon size={10} className={priorityDef.iconClass} />
              {priorityDef.label} priority
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-faint">
          <TypeIcon size={12} />
          <span className="truncate max-w-[200px]">{comment.item_title}</span>
          <span>·</span>
          <span>{comment.author_name}</span>
          <span>·</span>
          <span>{formatTimeAgo(comment.created_at)}</span>
          {comment.reply_count > 0 && (
            <>
              <span>·</span>
              <span className="text-teal">
                {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewItem();
          }}
          title="Open item"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-detail font-medium text-dim hover:text-ink hover:bg-gray-100 transition-colors"
        >
          <ExternalLink size={11} />
          View item
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleResolve();
          }}
          title={comment.resolved ? 'Reopen' : 'Mark resolved'}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-detail font-medium transition-colors ${
            comment.resolved
              ? 'text-amber-700 hover:bg-amber-50'
              : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {comment.resolved ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
          {comment.resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>

      {/* Resolved indicator (when row is not hovered) */}
      {comment.resolved && (
        <CheckCircle2
          size={16}
          className="text-emerald-500 shrink-0 mt-1 group-hover:hidden focus-within:hidden"
        />
      )}
    </div>
  );
}
