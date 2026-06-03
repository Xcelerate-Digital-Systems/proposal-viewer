// components/admin/proposals/ProposalListRow.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Trash2, ExternalLink } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import {
  type ProposalStatus,
  PROPOSAL_STATUS_CONFIG,
  getProposalStatusIcon,
} from '@/lib/proposals/status';

interface ProposalListRowProps {
  proposal: Proposal;
  onRefresh: () => void;
  customDomain?: string | null;
  hrefOverride?: string;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const getPageCount = (p: Proposal): number => {
  if (Array.isArray(p.page_names)) {
    return p.page_names.filter((pn) =>
      typeof pn === 'string' || (typeof pn === 'object' && pn.type !== 'group')
    ).length;
  }
  return 0;
};

export default function ProposalListRow({ proposal: p, onRefresh, customDomain, hrefOverride, selected, onToggleSelect }: ProposalListRowProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const status = (p.status as ProposalStatus) || 'draft';
  const def = PROPOSAL_STATUS_CONFIG[status] ?? PROPOSAL_STATUS_CONFIG.draft;
  const pageCount = getPageCount(p);

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildProposalUrl(p.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteProposal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Pitch',
      message: `Delete "${p.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const { error } = await supabase.from('proposals').delete().eq('id', p.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Pitch deleted');
      onRefresh();
    }
  };

  return (
    <div
      onClick={() => router.push(hrefOverride ?? (p.entity_type === 'quote' ? `/proposals/${p.id}/quote-pricing` : `/proposals/${p.id}/pages`))}
      className={`flex items-center gap-4 px-4 py-3 bg-white rounded-2xl shadow-card-soft hover:shadow-card cursor-pointer transition-shadow group ${selected ? 'ring-2 ring-teal/40' : ''}`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-edge-strong text-teal focus:ring-teal/30 shrink-0 cursor-pointer"
        />
      )}

      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${def.badge.bg} ${def.badge.text}`}>
        {getProposalStatusIcon(status)}
        {def.label}
      </span>

      {p.entity_type === 'quote' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-detail font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
          Quote
        </span>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
          {p.title}
        </h3>
        {p.client_name && (
          <p className="text-xs text-faint truncate">{p.client_name}</p>
        )}
      </div>

      <span className="text-xs text-faint shrink-0 hidden sm:block w-16 text-right">
        {p.entity_type === 'quote' ? 'Quote' : `${pageCount} page${pageCount !== 1 ? 's' : ''}`}
      </span>

      <span className="text-xs text-faint shrink-0 hidden md:block w-16 text-right">
        {formatDate(p.created_at)}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
          title="Copy share link"
        >
          {copied ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
        </button>
        <a
          href={`/view/${p.share_token}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
          title="Preview"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={deleteProposal}
          className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
