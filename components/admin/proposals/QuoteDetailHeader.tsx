// components/admin/proposals/QuoteDetailHeader.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Check, ExternalLink, Trash2,
  FileText, Clock, Eye, CheckCircle2, X, PenLine,
  DollarSign, Image, Settings, Package, AlignLeft, ScanEye,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'revision_requested' | 'declined';

interface QuoteDetailHeaderProps {
  proposalId: string;
  activeTab: 'quote-cover' | 'quote-pricing' | 'quote-packages' | 'quote-text-pages' | 'quote-details';
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const statusOptions: StatusOption<ProposalStatus>[] = [
  { value: 'draft',    label: 'Draft',    bg: 'bg-gray-100',    text: 'text-gray-500',   border: 'border-gray-200',   icon: <FileText size={13} /> },
  { value: 'sent',     label: 'Sent',     bg: 'bg-blue-50',     text: 'text-blue-600',   border: 'border-blue-200',   icon: <Clock size={13} /> },
  { value: 'viewed',   label: 'Viewed',   bg: 'bg-amber-50',    text: 'text-amber-600',  border: 'border-amber-200',  icon: <Eye size={13} /> },
  { value: 'revision_requested', label: 'Changes Requested', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: <PenLine size={13} /> },
  { value: 'accepted', label: 'Accepted', bg: 'bg-emerald-50',  text: 'text-emerald-600',border: 'border-emerald-200',icon: <CheckCircle2 size={13} /> },
  { value: 'declined', label: 'Declined', bg: 'bg-red-50',      text: 'text-red-500',    border: 'border-red-200',    icon: <X size={13} /> },
];

const tabs: { key: string; label: string; icon: typeof DollarSign; path: string }[] = [
  { key: 'quote-cover',       label: 'Cover',       icon: Image,       path: 'quote-cover' },
  { key: 'quote-pricing',     label: 'Pricing',     icon: DollarSign,  path: 'quote-pricing' },
  { key: 'quote-packages',    label: 'Packages',    icon: Package,     path: 'quote-packages' },
  { key: 'quote-text-pages',  label: 'Text Pages',  icon: AlignLeft,   path: 'quote-text-pages' },
  { key: 'quote-details',     label: 'Details',     icon: Settings,    path: 'quote-details' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function QuoteDetailHeader({
  proposalId,
  activeTab,
  customDomain,
}: QuoteDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const copyLink = () => {
    if (!proposal) return;
    const url = buildProposalUrl(proposal.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Quote link copied!');
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    if (!proposal) return;
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent' && proposal.status === 'draft') {
      updates.sent_at = new Date().toISOString();
    }
    const { error } = await supabase.from('proposals').update(updates).eq('id', proposal.id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      const label = statusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Quote marked as ${label}`);
      setProposal((prev) => prev ? { ...prev, status: newStatus } as Proposal : prev);
    }
  };

  const deleteQuote = async () => {
    if (!proposal) return;
    const ok = await confirm({
      title: 'Delete Quote',
      message: `Delete "${proposal.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('proposals').delete().eq('id', proposal.id);
    if (error) {
      toast.error('Failed to delete quote');
    } else {
      toast.success('Quote deleted');
      router.push('/');
    }
  };

  if (loading || !proposal) {
    return (
      <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
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

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
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
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
              {proposal.title}
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
              Quote
            </span>
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
          <StatusDropdown
            value={proposal.status as ProposalStatus}
            options={statusOptions}
            onChange={handleStatusChange}
            fullWidth={false}
          />
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <a
            href={`/proposals/${proposalId}/inline-edit`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-teal hover:bg-teal/5 border border-teal/20 transition-colors"
          >
            <ScanEye size={14} />
            Edit in Preview
          </a>
          <a
            href={`/view/${proposal.share_token}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-teal hover:bg-teal/5 border border-teal/20 transition-colors"
          >
            <ExternalLink size={14} />
            Preview
          </a>
          <button
            onClick={deleteQuote}
            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete quote"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 -mb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={`/proposals/${proposalId}/${tab.path}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-teal text-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
