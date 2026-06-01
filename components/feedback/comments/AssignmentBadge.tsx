'use client';

import { CheckCircle2, CircleDashed, Paperclip, X } from 'lucide-react';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';
import { supabase, type CommentTask } from '@/lib/supabase';

interface AssignmentBadgeProps {
  tasks: CommentTask[];
  memberLookup?: TeamMemberLookup;
  currentMemberId?: string | null;
  isAdmin?: boolean;
  onToggleComplete?: (taskId: string, completed: boolean) => Promise<void>;
  onRemove?: (taskId: string) => Promise<void>;
  onTaskClick?: (task: CommentTask) => void;
}

export default function AssignmentBadge({
  tasks,
  memberLookup,
  currentMemberId,
  isAdmin,
  onToggleComplete,
  onRemove,
  onTaskClick,
}: AssignmentBadgeProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-1.5">
      {tasks.map((task) => {
        const assigneeName = memberLookup?.[task.assigned_to]?.name || 'Team member';
        const done = !!task.completed_at;
        const isAssignee = currentMemberId === task.assigned_to;

        return (
          <div
            key={task.id}
            className={`rounded-lg px-3 py-2.5 text-xs ${
              done
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-amber-50 border border-amber-200'
            } ${onTaskClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
            onClick={() => onTaskClick?.(task)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {done ? (
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                ) : (
                  <CircleDashed size={14} className="text-amber-600 shrink-0" />
                )}
                <span className={`font-medium truncate ${done ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {done ? 'Completed' : 'Task'} — {assigneeName}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!done && (isAssignee || isAdmin) && onToggleComplete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id, true); }}
                    className="text-2xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    Complete
                  </button>
                )}
                {done && isAdmin && onToggleComplete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id, false); }}
                    className="text-2xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    Reopen
                  </button>
                )}
                {isAdmin && onRemove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(task.id); }}
                    className="p-0.5 rounded text-faint hover:text-prose transition-colors"
                    title="Remove task"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            {task.instructions && (
              <p className={`mt-1.5 leading-relaxed ${done ? 'text-emerald-700' : 'text-amber-700'}`}>
                {task.instructions}
              </p>
            )}
            {task.attachments && task.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {task.attachments.map((att, i) => {
                  const url = supabase.storage.from('company-assets').getPublicUrl(att.path).data.publicUrl;
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} hover:opacity-80 transition-opacity`}>
                      <Paperclip size={9} />
                      {att.name}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
