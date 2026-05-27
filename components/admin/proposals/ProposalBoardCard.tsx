'use client';

/**
 * Card used on the /proposals and /quotes kanban boards. Visually
 * mirrors the per-project KanbanCard (in components/admin/feedback/kanban)
 * so the experience is consistent: white rounded-2xl with subtle layered
 * shadow, icon tile in the top-left, footer separated by a light border
 * with meta on the left and "Open" link on the right.
 */

import Link from 'next/link';
import { FileText, ReceiptText, ExternalLink, Eye, CheckCircle2, XCircle, Send } from 'lucide-react';
import type { Proposal } from '@/lib/supabase';

interface Props {
  proposal: Proposal;
  /** 'proposals' (default) → /proposals/[id]/pages, or 'quotes' → /quotes/[id] */
  kind?: 'proposal' | 'quote';
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function ProposalBoardCard({ proposal, kind = 'proposal' }: Props) {
  const href = kind === 'quote' ? `/quotes/${proposal.id}` : `/proposals/${proposal.id}/pages`;
  const Icon = kind === 'quote' ? ReceiptText : FileText;
  const iconBg = 'bg-surface';
  const iconColor = 'text-muted';
  const typeLabel = kind === 'quote' ? 'Quote' : 'Pitch';

  // Pick the most relevant timestamp + matching icon for the footer meta.
  const meta = (() => {
    if (proposal.accepted_at)
      return { Icon: CheckCircle2, label: 'Accepted', when: proposal.accepted_at, tone: 'text-emerald-600' };
    if (proposal.declined_at)
      return { Icon: XCircle, label: 'Declined', when: proposal.declined_at, tone: 'text-red-500' };
    if (proposal.last_viewed_at)
      return { Icon: Eye, label: 'Viewed', when: proposal.last_viewed_at, tone: 'text-muted' };
    if (proposal.sent_at)
      return { Icon: Send, label: 'Sent', when: proposal.sent_at, tone: 'text-muted' };
    return null;
  })();
  const MetaIcon = meta?.Icon;

  return (
    <div className="group relative bg-white rounded-2xl shadow-card-soft hover:shadow-card-hover p-3.5 transition-all">
      <div className="flex items-start gap-2.5">
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={15} className={iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-ink truncate leading-tight">
            {proposal.title}
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {proposal.client_name || typeLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        {meta && MetaIcon ? (
          <div className={`flex items-center gap-1 text-[11px] ${meta.tone}`}>
            <MetaIcon size={11} />
            <span>{meta.label}</span>
            <span className="text-gray-400">· {formatShort(meta.when)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <span>Draft</span>
          </div>
        )}
        <Link
          href={href}
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
