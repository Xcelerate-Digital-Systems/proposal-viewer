'use client';

/**
 * Dashboard feedback pipeline — horizontal kanban of feedback projects,
 * grouped by status. Mirrors what's on /feedback in board view so dragging
 * a project here has the same effect as dragging it there.
 *
 * Items within a project don't appear at this level — open a project to
 * see its per-item kanban at /feedback/[id]/kanban.
 */

import Link from 'next/link';
import { MessageSquareText, ExternalLink, Layers, Calendar } from 'lucide-react';
import KanbanBoard, { type KanbanColumn } from '@/components/kanban/KanbanBoard';
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
import type { FeedbackProject } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/types/feedback';

interface Props {
  projects: FeedbackProject[];
  itemCounts: Record<string, number>;
  onMove: (id: string, next: FeedbackStatus) => Promise<void>;
}

function relativeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function FeedbackProjectCard({ project, itemCount }: { project: FeedbackProject; itemCount: number }) {
  const updated = project.updated_at || project.created_at;
  return (
    <div className="group relative bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_2px_8px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_4px_rgba(20,20,40,0.06),0_8px_20px_rgba(20,20,40,0.06)] p-3.5 transition-all">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50">
          <MessageSquareText size={15} className="text-purple-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-ink truncate leading-tight">
            {project.title}
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {project.client_name || 'Feedback project'}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Layers size={11} /> {itemCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} /> {relativeShort(updated)}
          </span>
        </div>
        <Link
          href={`/feedback/${project.id}/feedback`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex items-center gap-1 text-[11px] font-medium text-teal hover:text-teal-hover"
        >
          <ExternalLink size={11} />
          Open
        </Link>
      </div>
    </div>
  );
}

export default function FeedbackPipeline({ projects, itemCounts, onMove }: Props) {
  return (
    <KanbanBoard
      columns={REVIEW_STATUS_ORDER.map<KanbanColumn<FeedbackProject>>((status) => ({
        id: status,
        label: REVIEW_STATUS_CONFIG[status].label,
        accentHex: REVIEW_STATUS_CONFIG[status].hex,
        items: projects.filter((p) => p.status === status),
      }))}
      renderCard={(p) => <FeedbackProjectCard project={p} itemCount={itemCounts[p.id] ?? 0} />}
      onMove={(id, _from, to) => onMove(id, to as FeedbackStatus)}
      emptyMessage="Drag a project here."
    />
  );
}
