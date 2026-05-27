'use client';

// Two compact Filestage-style cards rendered above the Feedback section on
// the dashboard:
//   1. "Awaiting my review"  — items currently in a stage this user is
//      assigned to. Surfaces what the user needs to act on across projects.
//   2. "Needs new version"   — items currently in `revision_needed` across
//      the company. These are items waiting on the agency to upload a new
//      version per client feedback.
//
// Both lists cap at 5 visible rows + a "+N more" affordance that links to the
// owning project's kanban.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, RefreshCw, ArrowRight } from 'lucide-react';
import { supabase, type FeedbackItem, type FeedbackProject } from '@/lib/supabase';
import { getFeedbackStatusDef } from '@/lib/feedback/status';

interface FeedbackActionWidgetsProps {
  companyId: string;
  teamMemberId: string | null;
}

type ActionRow = {
  item: FeedbackItem;
  project: Pick<FeedbackProject, 'id' | 'title'>;
};

export default function FeedbackActionWidgets({ companyId, teamMemberId }: FeedbackActionWidgetsProps) {
  const [awaiting, setAwaiting] = useState<ActionRow[]>([]);
  const [needsVersion, setNeedsVersion] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Resolve which (project, stage) pairs are scoped to this user. An
      // empty `stages` array on an assignee row means "all stages" — those
      // are project-wide assignees and are excluded here so the widget shows
      // a tight per-stage action list rather than every project the user is
      // on. Users who want the broad view can use the feedback list page.
      const stageMap = new Map<string, Set<string>>(); // project_id -> stages
      if (teamMemberId) {
        const { data } = await supabase
          .from('review_project_assignees')
          .select('review_project_id, stages')
          .eq('team_member_id', teamMemberId);
        for (const row of (data ?? []) as { review_project_id: string; stages: string[] | null }[]) {
          if (!row.stages || row.stages.length === 0) continue;
          stageMap.set(row.review_project_id, new Set(row.stages));
        }
      }

      // Items pool — everything in the company that's currently in any stage
      // the widget could surface. One query is cheaper than many.
      const { data: itemRows } = await supabase
        .from('review_items')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['client_review', 'internal_review', 'revision_needed'])
        .order('updated_at', { ascending: false });
      const items = (itemRows ?? []) as FeedbackItem[];

      const projectIds = Array.from(new Set(items.map((i) => i.review_project_id)));
      const projectTitles = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('review_projects')
          .select('id, title')
          .in('id', projectIds);
        for (const p of (projects ?? []) as { id: string; title: string }[]) {
          projectTitles.set(p.id, p.title);
        }
      }

      const awaitingRows: ActionRow[] = [];
      const needsVersionRows: ActionRow[] = [];
      for (const item of items) {
        const project = {
          id: item.review_project_id,
          title: projectTitles.get(item.review_project_id) ?? 'Project',
        };
        if (item.status === 'revision_needed') {
          needsVersionRows.push({ item, project });
        }
        if (teamMemberId) {
          const stages = stageMap.get(item.review_project_id);
          if (stages && stages.has(item.status)) {
            awaitingRows.push({ item, project });
          }
        }
      }

      if (!cancelled) {
        setAwaiting(awaitingRows);
        setNeedsVersion(needsVersionRows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, teamMemberId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <WidgetCard
        icon={Eye}
        accentClass="bg-amber-100 text-amber-700"
        title="Awaiting my review"
        emptyHint={teamMemberId
          ? 'Nothing in a stage assigned to you right now.'
          : 'Assign yourself to a Kanban column to see items here.'}
        loading={loading}
        rows={awaiting}
      />
      <WidgetCard
        icon={RefreshCw}
        accentClass="bg-orange-100 text-orange-700"
        title="Needs new version"
        emptyHint="No items are flagged for revision."
        loading={loading}
        rows={needsVersion}
      />
    </div>
  );
}

/* ─── Card primitive ──────────────────────────────────────────────────── */

function WidgetCard({
  icon: Icon, accentClass, title, emptyHint, loading, rows,
}: {
  icon: typeof Eye;
  accentClass: string;
  title: string;
  emptyHint: string;
  loading: boolean;
  rows: ActionRow[];
}) {
  const shown = rows.slice(0, 5);
  const overflow = rows.length - shown.length;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-edge">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentClass}`}>
            <Icon size={14} />
          </div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <span className="text-detail text-muted">
            {loading ? '' : rows.length === 0 ? '' : `${rows.length}`}
          </span>
        </div>
      </header>

      {loading ? (
        <div className="px-5 py-8 text-center text-caption text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-caption text-muted">{emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-y divide-edge">
          {shown.map(({ item, project }) => {
            const def = getFeedbackStatusDef(item.status);
            return (
              <li key={item.id}>
                <Link
                  href={`/markup/${project.id}/items/${item.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-medium text-ink truncate">
                      {item.title || 'Untitled item'}
                    </p>
                    <p className="text-detail text-muted truncate">{project.title}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border shrink-0 ${def.bg} ${def.text} ${def.border}`}
                  >
                    <span className="[&>svg]:w-2.5 [&>svg]:h-2.5">{def.icon}</span>
                    {def.label}
                  </span>
                  <ArrowRight size={14} className="text-faint shrink-0" />
                </Link>
              </li>
            );
          })}
          {overflow > 0 && (
            <li className="px-5 py-3 text-center text-detail text-muted">
              Plus {overflow} more — open them from their markup project.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
