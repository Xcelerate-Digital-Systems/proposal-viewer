'use client';

/**
 * Compact card used on the /proposals and /quotes kanban boards.
 * Clicking the card navigates to the entity's edit page; we let the
 * surrounding KanbanBoard handle drag state so the link still fires on
 * a plain click.
 */

import Link from 'next/link';
import type { Proposal } from '@/lib/supabase';

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface Props {
  proposal: Proposal;
  /** 'proposals' (default) → /proposals/[id]/pages, or 'quotes' → /quotes/[id] */
  kind?: 'proposal' | 'quote';
}

export default function ProposalBoardCard({ proposal, kind = 'proposal' }: Props) {
  const href =
    kind === 'quote'
      ? `/quotes/${proposal.id}`
      : `/proposals/${proposal.id}/pages`;

  // Show the most relevant timestamp for the current status so the column
  // doubles as a recency cue without us having to add an explicit "moved at" field.
  const meta = (() => {
    if (proposal.accepted_at) return { label: 'Accepted', when: proposal.accepted_at };
    if (proposal.declined_at) return { label: 'Declined', when: proposal.declined_at };
    if (proposal.last_viewed_at) return { label: 'Last viewed', when: proposal.last_viewed_at };
    if (proposal.sent_at) return { label: 'Sent', when: proposal.sent_at };
    return null;
  })();

  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border border-edge p-3 hover:border-teal/40 hover:shadow-sm transition-all"
    >
      <div className="text-[13px] font-semibold text-ink line-clamp-2 leading-snug">
        {proposal.title}
      </div>
      {proposal.client_name && (
        <div className="text-[11px] text-faint mt-1 truncate">{proposal.client_name}</div>
      )}
      {meta && (
        <div className="text-[10px] text-faint mt-2">
          {meta.label} · {formatShort(meta.when)}
        </div>
      )}
    </Link>
  );
}
