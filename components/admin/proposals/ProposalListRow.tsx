// components/admin/proposals/ProposalListRow.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Trash2, ExternalLink, FileText, Clock, Eye,
  CheckCircle2, X,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProposalListRowProps {
  proposal: Proposal;
  onRefresh: () => void;
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const statusConfig: Record<string, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
  draft:    { icon: <FileText size={12} />,    bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Draft' },
  sent:     { icon: <Clock size={12} />,       bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Sent' },
  viewed:   { icon: <Eye size={12} />,         bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Viewed' },
  accepted: { icon: <CheckCircle2 size={12} />,bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Accepted' },
  declined: { icon: <X size={12} />,           bg: 'bg-red-50',     text: 'text-red-500',     label: 'Declined' },
};

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProposalListRow({ proposal: p, onRefresh, customDomain }: ProposalListRowProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const sc = statusConfig[p.status] || statusConfig.draft;
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
      title: 'Delete Proposal',
      message: `Delete "${p.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const { error } = await supabase.from('proposals').delete().eq('id', p.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Proposal deleted');
      onRefresh();
    }
  };

  return (
    <div
      onClick={() => router.push(`/proposals/${p.id}/pages`)}
      className="flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm cursor-pointer transition-colors group"
    >
      {/* Status badge */}
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 ${sc.bg} ${sc.text}`}>
        {sc.icon}
        {sc.label}
      </span>

      {/* Title + client */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-[#017C87] transition-colors">
          {p.title}
        </h3>
        {p.client_name && (
          <p className="text-xs text-gray-400 truncate">{p.client_name}</p>
        )}
      </div>

      {/* Page count */}
      <span className="text-xs text-gray-400 shrink-0 hidden sm:block w-16 text-right">
        {pageCount} page{pageCount !== 1 ? 's' : ''}
      </span>

      {/* Date */}
      <span className="text-xs text-gray-400 shrink-0 hidden md:block w-16 text-right">
        {formatDate(p.created_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Copy link"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
        <a
          href={`/view/${p.share_token}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Preview"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={deleteProposal}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}