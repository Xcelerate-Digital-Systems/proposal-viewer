// lib/feedback/stage-due-dates.ts
// Helper utilities for per-stage due dates on review projects.

import type { FeedbackStatus } from '@/lib/types/feedback';

/** Stages that support due dates — the active workflow stages. Terminal stages
 *  (approved, rejected, archived) don't need deadlines. */
export const STAGES_WITH_DUE_DATES: FeedbackStatus[] = [
  'draft',
  'in_progress',
  'internal_review',
  'client_review',
  'revision_needed',
];

export type StageDueDateUrgency = 'normal' | 'soon' | 'overdue';

/** Compute urgency from a due date string (YYYY-MM-DD). */
export function getStageDueDateUrgency(dueDateStr: string): StageDueDateUrgency {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDateStr + 'T23:59:59');
  if (due < now) return 'overdue';

  const dueDay = new Date(dueDateStr + 'T00:00:00');
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = diffMs / 86400000;
  if (diffDays <= 1) return 'soon'; // due today or tomorrow
  return 'normal';
}

/** Format a due date as a relative label. */
export function formatStageDueDate(dueDateStr: string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(dueDateStr + 'T00:00:00');
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return 'Yesterday';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7) return `in ${diff}d`;
  return dueDay.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/** Check if any stage in the map is overdue. */
export function hasOverdueStage(stageDueDates: Record<string, string>): boolean {
  const now = new Date();
  for (const dateStr of Object.values(stageDueDates)) {
    if (!dateStr) continue;
    const due = new Date(dateStr + 'T23:59:59');
    if (due < now) return true;
  }
  return false;
}

/** Get the next upcoming due date across all stages. Returns null if none. */
export function getNextStageDueDate(stageDueDates: Record<string, string>): {
  stage: string;
  date: string;
  urgency: StageDueDateUrgency;
} | null {
  let earliest: { stage: string; date: string; urgency: StageDueDateUrgency } | null = null;
  const now = new Date();

  for (const [stage, dateStr] of Object.entries(stageDueDates)) {
    if (!dateStr) continue;
    const due = new Date(dateStr + 'T00:00:00');
    // Skip past stages whose deadline has long passed (more than 7 days ago)
    const daysAgo = (now.getTime() - due.getTime()) / 86400000;
    if (daysAgo > 7) continue;

    if (!earliest || due < new Date(earliest.date + 'T00:00:00')) {
      earliest = { stage, date: dateStr, urgency: getStageDueDateUrgency(dateStr) };
    }
  }

  return earliest;
}
