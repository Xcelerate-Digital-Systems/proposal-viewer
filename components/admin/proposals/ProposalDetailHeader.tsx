// components/admin/proposals/ProposalDetailHeader.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Check, ExternalLink, Trash2,
  FileText, Clock, Eye, CheckCircle2, X, PenLine } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { Button, buttonClasses } from '@/components/ui/Button';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import ProposalTabs from './ProposalTabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'revision_requested' | 'declined';

interface ProposalDetailHeaderProps {
  proposal: Proposal;
  customDomain?: string | null;
  onProposalChange?: (next: Proposal) => void;
}

/* ------------------------------------------------------------------ */
/*  Status options                                                     */
/* ------------------------------------------------------------------ */

const statusOptions: StatusOption<ProposalStatus>[] = [
  { value: 'draft',    label: 'Draft',    bg: 'bg-surface',     text: 'text-muted',        border: 'border-edge',          icon: <FileText size={13} /> },
  { value: 'sent',     label: 'Sent',     bg: 'bg-surface',     text: 'text-muted',        border: 'border-edge',          icon: <Clock size={13} /> },
  { value: 'viewed',   label: 'Viewed',   bg: 'bg-surface',     text: 'text-muted',        border: 'border-edge',          icon: <Eye size={13} /> },
  { value: 'revision_requested', label: 'Changes Requested', bg: 'bg-surface', text: 'text-muted', border: 'border-edge', icon: <PenLine size={13} /> },
  { value: 'accepted', label: 'Accepted', bg: 'bg-emerald-50',  text: 'text-emerald-600',  border: 'border-emerald-200',   icon: <CheckCircle2 size={13} /> },
  { value: 'declined', label: 'Declined', bg: 'bg-red-50',      text: 'text-red-500',      border: 'border-red-200',       icon: <X size={13} /> },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProposalDetailHeader({
  proposal,
  customDomain,
  onProposalChange,
}: ProposalDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = buildProposalUrl(proposal.share_token, customDomain ?? null, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent' && proposal.status === 'draft') {
      updates.sent_at = new Date().toISOString();
    }
    // Moving back to draft (e.g. after fixing a mistake) clears the view-
    // tracking fields so the next real send fires a fresh first-view
    // notification instead of being suppressed by stale state.
    if (newStatus === 'draft') {
      updates.first_viewed_at = null;
      updates.last_viewed_at = null;
      updates.sent_at = null;
    }

    const { error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', proposal.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      const label = statusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Pitch marked as ${label}`);
      onProposalChange?.({ ...proposal, status: newStatus } as Proposal);
    }
  };

  const deleteProposal = async () => {
    const ok = await confirm({
      title: 'Delete Pitch',
      message: `Delete "${proposal.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const { error } = await supabase.from('proposals').delete().eq('id', proposal.id);
    if (error) {
      toast.error('Failed to delete pitch');
    } else {
      toast.success('Pitch deleted');
      router.push('/');
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-gray-100 lg:border-b-0">
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
              {proposal.title}
            </h1>
            <EditorSaveStatusBadge />
          </div>
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
          <Button
            variant="secondary"
            size="sm"
            leftIcon={copied ? Check : Copy}
            onClick={copyLink}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>

          {/* Preview */}
          <a
            href={`/view/${proposal.share_token}`}
            target="_blank"
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
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
      <ProposalTabs proposalId={proposal.id} />
    </div>
  );
}
