'use client';

/**
 * Dashboard feedback pipeline — horizontal kanban of feedback projects,
 * grouped by status. Mirrors what's on /feedback in board view so dragging
 * a project here has the same effect as dragging it there.
 *
 * Each card has a three-dot menu with Delete (with confirm) — same pattern
 * as FeedbackProjectCard on /feedback.
 *
 * Items within a project don't appear at this level — open a project to
 * see its per-item kanban at /feedback/[id]/kanban.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquareText, ExternalLink, Layers, Calendar, MoreHorizontal, Trash2,
} from 'lucide-react';
import KanbanBoard, { type KanbanColumn } from '@/components/kanban/KanbanBoard';
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/types/feedback';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface Props {
  projects: FeedbackProject[];
  itemCounts: Record<string, number>;
  onMove: (id: string, next: FeedbackStatus) => Promise<void>;
  onDeleted: (id: string) => void;
  contained?: boolean;
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

function FeedbackProjectCard({
  project,
  itemCount,
  onDeleted,
}: {
  project: FeedbackProject;
  itemCount: number;
  onDeleted: (id: string) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDelete = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Delete Feedback Project',
      message: `Delete "${project.title}"? This will remove all items, comments, and versions permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    const { error } = await supabase.from('review_projects').delete().eq('id', project.id);
    if (error) {
      toast.error('Failed to delete project');
      setDeleting(false);
      return;
    }
    toast.success('Project deleted');
    onDeleted(project.id);
  };

  const updated = project.updated_at || project.created_at;

  return (
    <div
      className={`group relative bg-white rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 p-3.5 transition-all ${
        deleting ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-surface">
          <MessageSquareText size={15} className="text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-caption font-medium text-ink truncate leading-tight">
            {project.title}
          </h4>
          <p className="text-detail text-faint mt-0.5 truncate">
            {project.client_company || project.client_name || 'Campaign'}
          </p>
        </div>

        {/* Three-dot menu — stops drag propagation so menu/click work. */}
        <div className="relative" ref={menuRef}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface"
            title="More"
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-40 bg-white rounded-2xl shadow-lg border border-edge-strong overflow-hidden z-20"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <Trash2 size={13} />
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
        <div className="flex items-center gap-2 text-detail text-dim">
          <span className="inline-flex items-center gap-1">
            <Layers size={11} /> {itemCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} /> {relativeShort(updated)}
          </span>
        </div>
        <Link
          href={`/campaigns/${project.id}/comments`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex items-center gap-1 text-detail font-medium text-teal hover:text-teal-hover"
        >
          <ExternalLink size={11} />
          Open
        </Link>
      </div>
    </div>
  );
}

export default function FeedbackPipeline({ projects, itemCounts, onMove, onDeleted, contained }: Props) {
  return (
    <KanbanBoard
      contained={contained}
      columns={REVIEW_STATUS_ORDER.map<KanbanColumn<FeedbackProject>>((status) => ({
        id: status,
        label: REVIEW_STATUS_CONFIG[status].label,
        accentHex: REVIEW_STATUS_CONFIG[status].hex,
        items: projects.filter((p) => p.status === status),
      }))}
      renderCard={(p) => (
        <FeedbackProjectCard
          project={p}
          itemCount={itemCounts[p.id] ?? 0}
          onDeleted={onDeleted}
        />
      )}
      onMove={(id, _from, to) => onMove(id, to as FeedbackStatus)}
      emptyMessage="Drag a project here."
    />
  );
}
