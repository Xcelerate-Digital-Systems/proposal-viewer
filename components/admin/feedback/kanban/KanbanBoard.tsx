'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import {
  supabase, type FeedbackItem, type FeedbackStatus,
} from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';
import {
  REVIEW_STATUS_ORDER, getFeedbackStatusDef,
} from '@/lib/feedback/status';
import KanbanCard, { type ItemDecisionTally } from './KanbanCard';
import KanbanColumnAssignees, {
  type StageMember, type StageGuest, type CompanyMember, type ProjectGuest,
} from './KanbanColumnAssignees';

interface KanbanBoardProps {
  items: FeedbackItem[];
  commentCounts: Record<string, { total: number; unresolved: number }>;
  onOpen: (itemId: string) => void;
  onItemsChange: (next: FeedbackItem[]) => void;
  /** Project + company ids enable per-stage assignee management. Optional so
   *  unauth/preview contexts can render the board read-only. */
  projectId?: string;
  companyId?: string;
}

/**
 * Status columns — archived is intentionally last and always rendered, but users
 * can collapse everything by dragging items out of it. We keep all 8 statuses
 * visible so the board reflects the real workflow, including terminal states.
 */
const COLUMN_ORDER: FeedbackStatus[] = REVIEW_STATUS_ORDER;

export default function KanbanBoard({
  items, commentCounts, onOpen, onItemsChange, projectId, companyId,
}: KanbanBoardProps) {
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Per-stage assignee roster, loaded once per project and refreshed after edits.
  const [stageMembers, setStageMembers] = useState<StageMember[]>([]);
  const [stageGuests, setStageGuests] = useState<StageGuest[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [projectGuests, setProjectGuests] = useState<ProjectGuest[]>([]);
  // Per-item decision tallies (approved / changes_requested) for the current
  // stage, indexed by item id. Refreshed alongside items.
  const [decisionTallies, setDecisionTallies] = useState<Record<string, ItemDecisionTally>>({});

  const refetchAssignees = useCallback(async () => {
    if (!projectId || !companyId) return;
    try {
      // Two fetches in parallel: stage-scoped assignees (members + guests
      // already on a column) and the project-level guest pool (everyone who
      // could be invited to a stage). Pool comes from /guests so the picker
      // can offer existing contacts without retyping emails.
      const [stageRes, poolRes] = await Promise.all([
        authFetch(`/api/markup-projects/${projectId}/stage-assignees?company_id=${companyId}`),
        authFetch(`/api/markup-projects/${projectId}/guests?company_id=${companyId}`),
      ]);
      if (stageRes.ok) {
        const data = await stageRes.json();
        // Hydrate avatar URLs for stage members from companyMembers (which
        // already has signed avatar URLs loaded in the effect below). We do
        // the join client-side to avoid double-signing the same paths.
        const memberRows = (data.members ?? []) as StageMember[];
        setStageMembers(memberRows);
        setStageGuests(data.guests ?? []);
      }
      if (poolRes.ok) {
        const data = await poolRes.json();
        type Raw = { email: string; name: string; removed?: boolean };
        const pool: ProjectGuest[] = (data.guests ?? [])
          .filter((g: Raw) => !g.removed)
          .map((g: Raw) => ({ email: g.email, name: g.name ?? '' }));
        setProjectGuests(pool);
      }
    } catch {
      // Non-fatal; the board still functions without the assignee chips.
    }
  }, [projectId, companyId]);

  useEffect(() => { refetchAssignees(); }, [refetchAssignees]);

  // Fetch decision tallies (Filestage "N approved / M requested changes") for
  // every item shown on the board. We aggregate per-(item, stage) so a vote
  // only counts on the stage it was cast on — moving an item between stages
  // doesn't leak votes forward.
  useEffect(() => {
    if (items.length === 0) {
      setDecisionTallies({});
      return;
    }
    let cancelled = false;
    (async () => {
      const itemIds = items.map((i) => i.id);
      const { data } = await supabase
        .from('review_item_decisions')
        .select('review_item_id, stage, decision')
        .in('review_item_id', itemIds);
      if (cancelled) return;
      const tallies: Record<string, ItemDecisionTally> = {};
      const itemStages = new Map(items.map((i) => [i.id, i.status]));
      for (const row of (data ?? []) as { review_item_id: string; stage: string; decision: string }[]) {
        // Only show votes that were cast on the item's *current* stage. A
        // vote on a prior stage stays in the table (so we can audit) but
        // doesn't surface once the item has moved on.
        if (itemStages.get(row.review_item_id) !== row.stage) continue;
        if (!tallies[row.review_item_id]) {
          tallies[row.review_item_id] = { approved: 0, changesRequested: 0 };
        }
        if (row.decision === 'approved') tallies[row.review_item_id].approved += 1;
        else if (row.decision === 'changes_requested') tallies[row.review_item_id].changesRequested += 1;
      }
      setDecisionTallies(tallies);
    })();
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      type MemberRow = { id: string; name: string | null; email: string; avatar_path: string | null; user_id: string | null };
      const { data } = await supabase
        .from('team_members')
        .select('id, name, email, avatar_path, user_id')
        .eq('company_id', companyId)
        .order('name');
      if (cancelled || !data) return;
      const rows = data as MemberRow[];

      // Avatars are stored per (user, company) — i.e. per membership — so a
      // user who has uploaded a picture in workspace A but not in workspace
      // B will look unphotographed when viewed from B. Backfill from any
      // OTHER membership of the same user_id that does have an avatar set;
      // RLS quietly drops rows the viewer can't see (so this really only
      // helps the current user's own avatar, which is the user-visible case
      // that triggered this fix). Long-term fix: lift avatar_path out of
      // team_members onto a per-user table.
      const missingUserIds = rows
        .filter((r) => !r.avatar_path && r.user_id)
        .map((r) => r.user_id as string);
      const fallbackByUserId = new Map<string, string>();
      if (missingUserIds.length > 0) {
        const { data: extras } = await supabase
          .from('team_members')
          .select('user_id, avatar_path')
          .in('user_id', missingUserIds)
          .not('avatar_path', 'is', null);
        for (const ex of (extras ?? []) as { user_id: string | null; avatar_path: string | null }[]) {
          if (ex.user_id && ex.avatar_path && !fallbackByUserId.has(ex.user_id)) {
            fallbackByUserId.set(ex.user_id, ex.avatar_path);
          }
        }
      }

      const hydrated: CompanyMember[] = await Promise.all(
        rows.map(async (r) => {
          const path = r.avatar_path ?? (r.user_id ? fallbackByUserId.get(r.user_id) ?? null : null);
          let avatar_url: string | null = null;
          if (path) {
            const { data: signed } = await supabase.storage
              .from('proposals')
              .createSignedUrl(path, 3600);
            avatar_url = signed?.signedUrl ?? null;
          }
          return { id: r.id, name: r.name, email: r.email, avatar_url };
        }),
      );
      if (!cancelled) setCompanyMembers(hydrated);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Index members/guests by stage so each column receives only its own slice.
  // Stage members are joined client-side against `companyMembers` so their
  // avatar URLs flow through to the column avatar stack without a second
  // fetch / re-sign of the same storage paths.
  const assigneesByStage = useMemo(() => {
    const avatarByMemberId = new Map<string, string | null>();
    for (const cm of companyMembers) avatarByMemberId.set(cm.id, cm.avatar_url ?? null);

    const out: Record<FeedbackStatus, { members: StageMember[]; guests: StageGuest[] }> =
      REVIEW_STATUS_ORDER.reduce((acc, s) => {
        acc[s] = { members: [], guests: [] };
        return acc;
      }, {} as Record<FeedbackStatus, { members: StageMember[]; guests: StageGuest[] }>);
    for (const m of stageMembers) {
      const enriched: StageMember = { ...m, avatar_url: avatarByMemberId.get(m.team_member_id) ?? null };
      // Empty stages array means "all stages" (back-compat); don't auto-broadcast
      // those into every column — they're project-wide assignees managed elsewhere.
      for (const s of m.stages) {
        if (s in out) out[s as FeedbackStatus].members.push(enriched);
      }
    }
    for (const g of stageGuests) {
      for (const s of g.stages) {
        if (s in out) out[s as FeedbackStatus].guests.push(g);
      }
    }
    return out;
  }, [stageMembers, stageGuests, companyMembers]);

  // Group items by status, preserving sort_order within each column.
  const columns = useMemo(() => {
    const map: Record<FeedbackStatus, FeedbackItem[]> = COLUMN_ORDER.reduce((acc, s) => {
      acc[s] = [];
      return acc;
    }, {} as Record<FeedbackStatus, FeedbackItem[]>);
    for (const item of items) {
      const key = (COLUMN_ORDER.includes(item.status) ? item.status : 'draft') as FeedbackStatus;
      map[key].push(item);
    }
    for (const key of COLUMN_ORDER) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [items]);

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  const handleDragStart = useCallback((ev: DragStartEvent) => {
    setActiveId(String(ev.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (ev: DragEndEvent) => {
      setActiveId(null);
      const itemId = String(ev.active.id);
      const overId = ev.over?.id ? String(ev.over.id) : null;
      if (!overId) return;

      // Drop zones are column containers identified by `column-<status>`.
      const targetStatus = overId.startsWith('column-')
        ? (overId.slice('column-'.length) as FeedbackStatus)
        : null;
      if (!targetStatus) return;

      const current = items.find((i) => i.id === itemId);
      if (!current || current.status === targetStatus) return;

      // Optimistic update — roll back if the write fails.
      const optimistic = items.map((i) => (i.id === itemId ? { ...i, status: targetStatus } : i));
      onItemsChange(optimistic);

      const { error } = await supabase
        .from('review_items')
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) {
        toast.error('Failed to update status');
        onItemsChange(items);
      }
    },
    [items, onItemsChange, toast]
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 lg:-mx-10 px-6 lg:px-10 h-full">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={columns[status]}
            commentCounts={commentCounts}
            decisionTallies={decisionTallies}
            onOpen={onOpen}
            projectId={projectId}
            stageMembers={assigneesByStage[status].members}
            stageGuests={assigneesByStage[status].guests}
            companyMembers={companyMembers}
            projectGuests={projectGuests}
            onAssigneesChanged={refetchAssignees}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 rotate-1">
            <KanbanCard
              item={activeItem}
              commentCount={commentCounts[activeItem.id]?.total ?? 0}
              unresolvedCount={commentCounts[activeItem.id]?.unresolved ?? 0}
              decisionTally={decisionTallies[activeItem.id]}
              onOpen={onOpen}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Column ───────────────────────────────────────────────────── */

function KanbanColumn({
  status, items, commentCounts, decisionTallies, onOpen,
  projectId, stageMembers, stageGuests, companyMembers, projectGuests, onAssigneesChanged,
}: {
  status: FeedbackStatus;
  items: FeedbackItem[];
  commentCounts: Record<string, { total: number; unresolved: number }>;
  decisionTallies: Record<string, ItemDecisionTally>;
  onOpen: (itemId: string) => void;
  projectId?: string;
  stageMembers: StageMember[];
  stageGuests: StageGuest[];
  companyMembers: CompanyMember[];
  projectGuests: ProjectGuest[];
  onAssigneesChanged: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  const def = getFeedbackStatusDef(status);

  return (
    <div className="shrink-0 w-[280px] flex flex-col h-full min-h-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className={`w-2 h-2 rounded-full ${def.dot}`} />
        <h3 className="text-caption font-semibold text-gray-800">{def.label}</h3>
        <span className="text-detail font-medium text-faint">{items.length}</span>
        {projectId && (
          <div className="ml-auto">
            <KanbanColumnAssignees
              projectId={projectId}
              stage={status}
              members={stageMembers}
              guests={stageGuests}
              companyMembers={companyMembers}
              projectGuests={projectGuests}
              onChanged={onAssigneesChanged}
            />
          </div>
        )}
      </div>

      {/* Droppable list */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-2xl p-3 space-y-2.5 overflow-y-auto transition-colors ${
          isOver ? 'bg-teal/10 ring-2 ring-teal/30' : 'bg-surface'
        }`}
      >
        {items.length === 0 ? (
          <div className="text-detail text-faint italic text-center py-4">
            Drop here
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              commentCount={commentCounts[item.id]?.total ?? 0}
              unresolvedCount={commentCounts[item.id]?.unresolved ?? 0}
              decisionTally={decisionTallies[item.id]}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}
