// components/admin/proposals/ProposalDetailHeader.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Check, Link2, ExternalLink, Trash2,
  FileText, Clock, Eye, CheckCircle2, X,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import ProposalTabs from './ProposalTabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';

interface ProposalDetailHeaderProps {
  proposalId: string;
  activeTab: 'pages' | 'pricing' | 'cover' | 'details';
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Status options                                                     */
/* ------------------------------------------------------------------ */

const statusOptions: StatusOption<ProposalStatus>[] = [
  {
    value: 'draft',
    label: 'Draft',
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-200',
    icon: <FileText size={13} />,
  },
  {
    value: 'sent',
    label: 'Sent',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    icon: <Clock size={13} />,
  },
  {
    value: 'viewed',
    label: 'Viewed',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    icon: <Eye size={13} />,
  },
  {
    value: 'accepted',
    label: 'Accepted',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    icon: <CheckCircle2 size={13} />,
  },
  {
    value: 'declined',
    label: 'Declined',
    bg: 'bg-red-50',
    text: 'text-red-500',
    border: 'border-red-200',
    icon: <X size={13} />,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProposalDetailHeader({
  proposalId,
  activeTab,
  customDomain,
}: ProposalDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  /* ── Fetch proposal ─────────────────────────────────────────── */

  const fetchProposal = useCallback(async () => {
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (data) setProposal(data);
    setLoading(false);
  }, [proposalId]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  /* ── Actions ────────────────────────────────────────────────── */

  const copyLink = () => {
    if (!proposal) return;
    const url = buildProposalUrl(proposal.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    if (!proposal) return;

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent' && proposal.status === 'draft') {
      updates.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', proposal.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      const label = statusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Proposal marked as ${label}`);
      setProposal((prev) => prev ? { ...prev, status: newStatus } as Proposal : prev);
    }
  };

  const deleteProposal = async () => {
    if (!proposal) return;
    const ok = await confirm({
      title: 'Delete Proposal',
      message: `Delete "${proposal.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const { error } = await supabase.from('proposals').delete().eq('id', proposal.id);
    if (error) {
      toast.error('Failed to delete proposal');
    } else {
      toast.success('Proposal deleted');
      router.push('/');
    }
  };

  /* ── Loading skeleton ───────────────────────────────────────── */

  if (loading || !proposal) {
    return (
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        <div className="inline-flex items-center gap-1.5 text-sm text-gray-400 mb-3">
          <ArrowLeft size={14} />
          All Proposals
        </div>
        <div className="animate-pulse">
          <div className="h-7 w-64 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-40 bg-gray-100 rounded mb-4" />
          <div className="h-10 w-full bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Proposals
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
            {proposal.title}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {proposal.client_name && (
              <span className="text-sm text-gray-400">{proposal.client_name}</span>
            )}
            {proposal.description && (
              <>
                {proposal.client_name && <span className="text-gray-200">·</span>}
                <span className="text-sm text-gray-400 truncate max-w-[300px]">
                  {proposal.description}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status dropdown */}
          <StatusDropdown
            value={proposal.status as ProposalStatus}
            options={statusOptions}
            onChange={handleStatusChange}
            fullWidth={false}
          />

          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {/* Preview */}
          <a
            href={`/view/${proposal.share_token}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#017C87] hover:bg-[#017C87]/5 border border-[#017C87]/20 transition-colors"
          >
            <ExternalLink size={14} />
            Preview
          </a>

          {/* Delete */}
          <button
            onClick={deleteProposal}
            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete proposal"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <ProposalTabs proposalId={proposalId} activeTab={activeTab} />
    </div>
  );
}