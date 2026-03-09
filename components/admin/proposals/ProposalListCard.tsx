// components/admin/proposals/ProposalListCard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Trash2, ExternalLink, FileText, Clock, Eye, CheckCircle2, X, FolderOpen, PenLine } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProposalListCardProps {
  proposal: Proposal;
  onRefresh: () => void;
  customDomain?: string | null;
}

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'revision_requested' | 'declined';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const statusOptions: StatusOption<ProposalStatus>[] = [
  { value: 'draft',    label: 'Draft',    bg: 'bg-gray-100',     text: 'text-gray-500',    border: 'border-gray-200',    icon: <FileText size={12} /> },
  { value: 'sent',     label: 'Sent',     bg: 'bg-blue-50',      text: 'text-blue-600',    border: 'border-blue-200',    icon: <Clock size={12} /> },
  { value: 'viewed',   label: 'Viewed',   bg: 'bg-amber-50',     text: 'text-amber-600',   border: 'border-amber-200',   icon: <Eye size={12} /> },
  { value:  'revision_requested', label:  'Changes Requested',   bg:     'bg-amber-50',     text:   'text-amber-600',  border: 'border-amber-200',  icon:   <PenLine size={13} />},
  { value: 'accepted', label: 'Accepted', bg: 'bg-emerald-50',   text: 'text-emerald-600', border: 'border-emerald-200', icon: <CheckCircle2 size={12} /> },
  { value: 'declined', label: 'Declined', bg: 'bg-red-50',       text: 'text-red-500',     border: 'border-red-200',     icon: <X size={12} /> },
];

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function ProposalListCard({ proposal: p, onRefresh, customDomain }: ProposalListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const pageCount = getPageCount(p);
  const size = formatSize(p.file_size_bytes);

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildProposalUrl(p.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent' && p.status === 'draft') {
      updates.sent_at = new Date().toISOString();
    }

    const { error } = await supabase.from('proposals').update(updates).eq('id', p.id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Marked as ${statusOptions.find((o) => o.value === newStatus)?.label}`);
      onRefresh();
    }
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
      {/* ─── Visual header — click to open ──────────────────── */}
      <button
        onClick={() => router.push(`/proposals/${p.id}/pages`)}
        className="w-full aspect-[4/3] rounded-t-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-5 border-b border-gray-100"
      >
        {pageCount > 0 ? (
          <div className="w-full flex flex-col items-center gap-3">
            {/* Large page count */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-gray-800">{pageCount}</span>
              <span className="text-sm text-gray-400 font-medium">page{pageCount !== 1 ? 's' : ''}</span>
            </div>

            {/* File size */}
            {size && (
              <span className="text-xs text-gray-400">{size}</span>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[#017C87]/10 flex items-center justify-center mx-auto mb-2">
              <FolderOpen size={22} className="text-[#017C87]" />
            </div>
            <p className="text-xs text-gray-400">No pages yet</p>
          </div>
        )}

        {/* Date overlay */}
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-400 border border-gray-200/60">
          {formatDate(p.created_at)}
        </span>
      </button>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        {/* Title */}
        <h3
          className="text-sm font-semibold font-[family-name:var(--font-display)] text-gray-900 truncate cursor-pointer hover:text-[#017C87] transition-colors mb-1"
          onClick={() => router.push(`/proposals/${p.id}/pages`)}
        >
          {p.title}
        </h3>

        {/* Client / description */}
        {(p.client_name || p.description) && (
          <p className="text-[11px] text-gray-400 truncate mb-2.5">
            {p.client_name}
            {p.client_name && p.description && ' · '}
            {p.description}
          </p>
        )}

        {/* Status dropdown */}
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <StatusDropdown
            value={p.status as ProposalStatus}
            options={statusOptions}
            onChange={handleStatusChange}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ─── Actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push(`/proposals/${p.id}/pages`)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
            >
              <Eye size={12} />
              Open
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Link'}
            </button>
            <a
              href={`/view/${p.share_token}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </a>
          </div>

          <button
            onClick={deleteProposal}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete proposal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}