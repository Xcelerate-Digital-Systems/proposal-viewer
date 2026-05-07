// components/admin/proposals/QuoteDetailHeader.tsx
'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Check, ExternalLink, Trash2,
  FileText, Clock, Eye, CheckCircle2, X, PenLine,
  DollarSign, Paintbrush, Settings, Package, AlignLeft, Pencil, List, Wand2,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'revision_requested' | 'declined';

interface QuoteDetailHeaderProps {
  proposal: Proposal;
  customDomain?: string | null;
  onProposalChange?: (next: Proposal) => void;
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

type TabGroup = 'content' | 'setup';

const tabs: { key: string; label: string; icon: typeof DollarSign; path: string; group: TabGroup }[] = [
  // Content
  { key: 'quote-builder',     label: 'Builder',   icon: Wand2,      path: 'quote-builder',    group: 'content' },
  { key: 'quote-pages',       label: 'Pages',     icon: Pencil,     path: 'quote-pages',      group: 'content' },
  { key: 'quote-text-pages',  label: 'Text',      icon: AlignLeft,  path: 'quote-text-pages', group: 'content' },
  { key: 'quote-pricing',     label: 'Quote',     icon: DollarSign, path: 'quote-pricing',    group: 'content' },
  { key: 'quote-packages',    label: 'Packages',  icon: Package,    path: 'quote-packages',   group: 'content' },

  // Setup
  { key: 'quote-cover',       label: 'Design',    icon: Paintbrush, path: 'quote-cover',      group: 'setup' },
  { key: 'quote-contents',    label: 'Contents',  icon: List,       path: 'quote-contents',   group: 'setup' },
  { key: 'quote-details',     label: 'Details',   icon: Settings,   path: 'quote-details',    group: 'setup' },
];

function activeKeyFromPath(pathname: string | null): string {
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  return segments[2] ?? '';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function QuoteDetailHeader({
  proposal,
  customDomain,
  onProposalChange,
}: QuoteDetailHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();
  const toast = useToast();

  const [copied, setCopied] = useState(false);
  const activeKey = activeKeyFromPath(pathname);

  const copyLink = () => {
    const url = buildProposalUrl(proposal.share_token, customDomain ?? null, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Quote link copied!');
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent' && proposal.status === 'draft') {
      updates.sent_at = new Date().toISOString();
    }
    // Reset view-tracking when moving back to draft so a later real send
    // still triggers the first-view notification.
    if (newStatus === 'draft') {
      updates.first_viewed_at = null;
      updates.last_viewed_at = null;
      updates.sent_at = null;
    }
    const { error } = await supabase.from('proposals').update(updates).eq('id', proposal.id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      const label = statusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Quote marked as ${label}`);
      onProposalChange?.({ ...proposal, status: newStatus } as Proposal);
    }
  };

  const deleteQuote = async () => {
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
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
              {proposal.title}
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
              Quote
            </span>
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
        {tabs.map((tab, i) => {
          const isActive = activeKey === tab.key;
          const Icon = tab.icon;
          const showDivider = i > 0 && tabs[i - 1].group !== tab.group;
          return (
            <div key={tab.key} className="flex items-center">
              {showDivider && <div className="w-px h-5 bg-gray-200 mx-2" aria-hidden />}
              <Link
                href={`/proposals/${proposal.id}/${tab.path}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-teal text-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
