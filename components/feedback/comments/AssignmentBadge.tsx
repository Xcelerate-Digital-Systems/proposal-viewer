'use client';

import { CheckCircle2, CircleDashed, X } from 'lucide-react';
import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';

interface AssignmentBadgeProps {
  assignedTo: string;
  assignmentNote: string | null;
  completedAt: string | null;
  memberLookup?: TeamMemberLookup;
  /** Current user's team_member_id — shows "Mark Complete" when they're the assignee */
  currentMemberId?: string | null;
  onComplete?: () => Promise<void>;
  onReopen?: () => Promise<void>;
  onRemove?: () => Promise<void>;
  isAdmin?: boolean;
}

export default function AssignmentBadge({
  assignedTo,
  assignmentNote,
  completedAt,
  memberLookup,
  currentMemberId,
  onComplete,
  onReopen,
  onRemove,
  isAdmin,
}: AssignmentBadgeProps) {
  const assigneeName = memberLookup?.[assignedTo]?.name || 'Team member';
  const isCompleted = !!completedAt;
  const isAssignee = currentMemberId === assignedTo;

  return (
    <div
      className={`mt-2.5 rounded-lg px-3 py-2.5 text-xs ${
        isCompleted
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-amber-50 border border-amber-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCompleted ? (
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          ) : (
            <CircleDashed size={14} className="text-amber-600 shrink-0" />
          )}
          <span className={`font-medium truncate ${isCompleted ? 'text-emerald-800' : 'text-amber-800'}`}>
            {isCompleted ? 'Completed' : 'Assigned'} — {assigneeName}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isCompleted && (isAssignee || isAdmin) && onComplete && (
            <button
              onClick={onComplete}
              className="text-2xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
            >
              Mark Complete
            </button>
          )}
          {isCompleted && isAdmin && onReopen && (
            <button
              onClick={onReopen}
              className="text-2xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors"
            >
              Reopen
            </button>
          )}
          {isAdmin && onRemove && (
            <button
              onClick={onRemove}
              className="p-0.5 rounded text-faint hover:text-prose transition-colors"
              title="Remove assignment"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {assignmentNote && (
        <p className={`mt-1.5 leading-relaxed ${isCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
          {assignmentNote}
        </p>
      )}
    </div>
  );
}
