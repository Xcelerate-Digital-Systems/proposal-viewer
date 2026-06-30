'use client';

import { CheckCircle2, CircleDashed, Paperclip } from 'lucide-react';
import type { CommentTask } from '@/lib/types/feedback';

export default function TaskRow({ task, memberNameMap, onToggleComplete, onViewComment }: {
  task: CommentTask & { commentContent: string; commentThreadNum: number | null };
  memberNameMap: Record<string, string>;
  onToggleComplete: () => void;
  onViewComment: () => void;
}) {
  const name = memberNameMap[task.assigned_to] || 'Team member';
  const done = !!task.completed_at;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewComment(); } }}
      className={`px-4 py-3 hover:bg-surface/50 transition-colors cursor-pointer ${done ? 'opacity-60' : ''}`}
      onClick={onViewComment}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
          className="shrink-0"
          title={done ? 'Reopen' : 'Mark complete'}
        >
          {done ? (
            <CheckCircle2 size={16} className="text-emerald-500 hover:text-emerald-600" />
          ) : (
            <CircleDashed size={16} className="text-amber-500 hover:text-amber-600" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${done ? 'text-faint line-through' : 'text-ink'}`}>
            {name}
          </p>
          {task.instructions && (
            <p className="text-xs text-faint truncate mt-0.5">{task.instructions}</p>
          )}
        </div>
        {task.commentThreadNum && (
          <span className="px-1.5 py-0.5 rounded bg-teal/10 text-2xs font-bold text-teal shrink-0">
            #{task.commentThreadNum}
          </span>
        )}
      </div>
      {task.attachments && task.attachments.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 ml-6">
          <Paperclip size={10} className="text-faint" />
          <span className="text-2xs text-faint">{task.attachments.length} file{task.attachments.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
