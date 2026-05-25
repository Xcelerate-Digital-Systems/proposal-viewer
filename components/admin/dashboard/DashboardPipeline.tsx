'use client';

/**
 * Dashboard pipeline — horizontal kanban of every proposal AND quote
 * (entity_type IN ('proposal','quote')), grouped by status. Reuses the
 * shared KanbanBoard so the dashboard mirrors what users see on /proposals
 * and /quotes: drag to change status, click "Open" to jump to the editor.
 *
 * Kept intentionally thin — the page passes us the merged list and the
 * mutation callback; we just slot it into the kanban columns.
 */

import KanbanBoard, { type KanbanColumn } from '@/components/kanban/KanbanBoard';
import ProposalBoardCard from '@/components/admin/proposals/ProposalBoardCard';
import {
  PROPOSAL_STATUS_ORDER,
  PROPOSAL_STATUS_CONFIG,
  type ProposalStatus,
} from '@/lib/proposals/status';
import type { Proposal } from '@/lib/supabase';

interface Props {
  items: Proposal[];
  onMove: (id: string, next: ProposalStatus) => Promise<void>;
}

export default function DashboardPipeline({ items, onMove }: Props) {
  return (
    <KanbanBoard
      columns={PROPOSAL_STATUS_ORDER.map<KanbanColumn<Proposal>>((status) => ({
        id: status,
        label: PROPOSAL_STATUS_CONFIG[status].label,
        accentHex: PROPOSAL_STATUS_CONFIG[status].hex,
        items: items.filter((p) => p.status === status),
      }))}
      renderCard={(p) => (
        <ProposalBoardCard
          proposal={p}
          kind={p.entity_type === 'quote' ? 'quote' : 'proposal'}
        />
      )}
      onMove={(id, _from, to) => onMove(id, to as ProposalStatus)}
      emptyMessage="Nothing here."
    />
  );
}
