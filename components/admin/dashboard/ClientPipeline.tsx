'use client';

import Link from 'next/link';
import {
  FileText, ReceiptText, Eye, CheckCircle2, XCircle, Send, ExternalLink,
} from 'lucide-react';
import {
  PROPOSAL_STATUS_ORDER,
  PROPOSAL_STATUS_CONFIG,
  type ProposalStatus,
} from '@/lib/proposals/status';
import type { Proposal } from '@/lib/supabase';

interface Props {
  items: Proposal[];
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function ClientCard({ proposal }: { proposal: Proposal }) {
  const isQuote = proposal.entity_type === 'quote';
  const Icon = isQuote ? ReceiptText : FileText;
  const typeLabel = isQuote ? 'Quote' : 'Proposal';
  const viewerHref = `/view/${proposal.share_token}`;

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
    <div className="bg-white rounded-2xl shadow-card p-3.5 transition-all hover:shadow-card-hover">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-surface flex items-center justify-center">
          <Icon size={15} className="text-muted" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-caption font-medium text-ink truncate leading-tight">
            {proposal.title}
          </h4>
          <p className="text-detail text-faint mt-0.5 truncate">
            {typeLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
        {meta && MetaIcon ? (
          <div className={`flex items-center gap-1 text-detail ${meta.tone}`}>
            <MetaIcon size={11} />
            <span>{meta.label}</span>
            <span className="text-faint">· {formatShort(meta.when)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-detail text-faint">
            <span>Pending</span>
          </div>
        )}
        <Link
          href={viewerHref}
          target="_blank"
          className="inline-flex items-center gap-1 text-detail font-medium text-teal hover:text-teal-hover"
        >
          <ExternalLink size={11} />
          View
        </Link>
      </div>
    </div>
  );
}

export default function ClientPipeline({ items }: Props) {
  const clientStatuses: ProposalStatus[] = PROPOSAL_STATUS_ORDER.filter((s) => s !== 'draft');

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full px-5">
      {clientStatuses.map((status) => {
        const config = PROPOSAL_STATUS_CONFIG[status];
        const columnItems = items.filter((p) => p.status === status);

        return (
          <div
            key={status}
            className="flex flex-col min-w-[220px] max-w-[280px] flex-1 shrink-0"
          >
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: config.hex }}
              />
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                {config.label}
              </span>
              <span className="text-detail text-faint">{columnItems.length}</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto min-h-0 px-0.5">
              {columnItems.length === 0 ? (
                <div className="py-8 text-center text-detail text-faint">
                  Nothing here
                </div>
              ) : (
                columnItems.map((p) => <ClientCard key={p.id} proposal={p} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
