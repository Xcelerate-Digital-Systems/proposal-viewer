// components/admin/quotes/QuoteShellHeader.tsx
// Three-tab header for the independent /quotes detail area:
//   Builder  → /quotes/[id]
//   Cover    → /quotes/[id]/cover
//   Settings → /quotes/[id]/settings
//
// Mirrors QuoteDetailHeader's status/copy/preview/duplicate/delete actions
// but routes to the new /quotes paths instead of /proposals/[id]/quote-*.
'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Check, ExternalLink, Trash2, Download, BookmarkPlus,
  FileText, Clock, Eye, CheckCircle2, X, PenLine,
  Paintbrush, Wand2, SlidersHorizontal, Files, Loader2,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { formatQuoteNumber } from '@/lib/quote-number';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';
import { Button, buttonClasses } from '@/components/ui/Button';

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'revision_requested' | 'declined';

interface QuoteShellHeaderProps {
  proposal: Proposal;
  customDomain?: string | null;
  onProposalChange?: (next: Proposal) => void;
}

const statusOptions: StatusOption<ProposalStatus>[] = [
  { value: 'draft',    label: 'Draft',    bg: 'bg-gray-100',    text: 'text-gray-500',   border: 'border-gray-200',   icon: <FileText size={13} /> },
  { value: 'sent',     label: 'Sent',     bg: 'bg-blue-50',     text: 'text-blue-600',   border: 'border-blue-200',   icon: <Clock size={13} /> },
  { value: 'viewed',   label: 'Viewed',   bg: 'bg-amber-50',    text: 'text-amber-600',  border: 'border-amber-200',  icon: <Eye size={13} /> },
  { value: 'revision_requested', label: 'Changes Requested', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: <PenLine size={13} /> },
  { value: 'accepted', label: 'Accepted', bg: 'bg-emerald-50',  text: 'text-emerald-600',border: 'border-emerald-200',icon: <CheckCircle2 size={13} /> },
  { value: 'declined', label: 'Declined', bg: 'bg-red-50',      text: 'text-red-500',    border: 'border-red-200',    icon: <X size={13} /> },
];

const tabs = [
  { key: '',         label: 'Builder',  icon: Wand2,             segment: '' },
  { key: 'cover',    label: 'Cover',    icon: Paintbrush,        segment: 'cover' },
  { key: 'settings', label: 'Settings', icon: SlidersHorizontal, segment: 'settings' },
];

function activeKeyFromPath(pathname: string | null): string {
  if (!pathname) return '';
  // /quotes/[id]            → ''
  // /quotes/[id]/cover      → 'cover'
  // /quotes/[id]/settings   → 'settings'
  const segs = pathname.split('/').filter(Boolean);
  return segs[2] ?? '';
}

export default function QuoteShellHeader({
  proposal,
  customDomain,
  onProposalChange,
}: QuoteShellHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();
  const toast = useToast();
  const { companyInfo } = useProposalDetail();
  const [copied, setCopied] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const activeKey = activeKeyFromPath(pathname);

  const quoteNumberFormat = companyInfo
    ? { prefix: companyInfo.quoteNumberPrefix, padWidth: companyInfo.quoteNumberPadWidth }
    : undefined;

  const copyLink = () => {
    const url = buildProposalUrl(proposal.share_token, customDomain ?? null, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Quote link copied!');
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent' && proposal.status === 'draft') updates.sent_at = new Date().toISOString();
    if (newStatus === 'draft') {
      updates.first_viewed_at = null;
      updates.last_viewed_at = null;
      updates.sent_at = null;
    }
    const { error } = await supabase.from('proposals').update(updates).eq('id', proposal.id);
    if (error) toast.error('Failed to update status');
    else {
      const label = statusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Quote marked as ${label}`);
      onProposalChange?.({ ...proposal, status: newStatus } as Proposal);
    }
  };

  const saveAsTemplate = async () => {
    const name = window.prompt(
      'Save this quote as a template. Templates remember design, line items, terms, scope — but not the client.',
      `${proposal.title} — Template`,
    );
    if (!name?.trim()) return;
    setSavingTemplate(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/quotes/${proposal.id}/save-as-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(`Saved as "${json.name}"`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save as template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const duplicateQuote = async () => {
    const ok = await confirm({
      title: 'Duplicate quote?',
      message: `Create a draft copy of "${proposal.title}" with a new quote number.`,
      confirmLabel: 'Duplicate',
    });
    if (!ok) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token ?? ''}`,
        },
      });
      const json = await res.json();
      if (!res.ok || !json.id) throw new Error(json.error ?? 'Failed');
      toast.success('Quote duplicated');
      router.push(`/quotes/${json.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to duplicate');
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
    if (error) toast.error('Failed to delete quote');
    else {
      toast.success('Quote deleted');
      router.push('/quotes');
    }
  };

  const tabHref = (segment: string) =>
    segment === '' ? `/quotes/${proposal.id}` : `/quotes/${proposal.id}/${segment}`;

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-gray-100 lg:border-b-0">
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Quotes
      </Link>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
              {proposal.title}
            </h1>
            {formatQuoteNumber(proposal.quote_number, quoteNumberFormat) && (
              <span className="text-[11px] font-medium text-gray-400 tabular-nums shrink-0">
                {formatQuoteNumber(proposal.quote_number, quoteNumberFormat)}
              </span>
            )}
            {proposal.is_test && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-status-test-tint text-status-test border border-status-test-border shrink-0">
                Test
              </span>
            )}
            <EditorSaveStatusBadge />
          </div>
          <div className="flex items-center gap-3 mt-1">
            {proposal.client_name && (
              <span className="text-sm text-gray-400">{proposal.client_name}</span>
            )}
            {proposal.category && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-sm text-gray-400">{proposal.category}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusDropdown
            value={proposal.status as ProposalStatus}
            options={statusOptions}
            onChange={handleStatusChange}
            fullWidth={false}
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={copied ? Check : Copy}
            onClick={copyLink}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <a
            href={`/view/${proposal.share_token}`}
            target="_blank"
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink size={14} />
            Preview
          </a>
          <a
            href={`/view/${proposal.share_token}?print=1`}
            target="_blank"
            title="Open the public viewer and trigger print/save-PDF"
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            <Download size={14} />
            PDF
          </a>
          <button
            onClick={saveAsTemplate}
            disabled={savingTemplate}
            className="p-2 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Save as quote template"
          >
            {savingTemplate ? <Loader2 size={16} className="animate-spin" /> : <BookmarkPlus size={16} />}
          </button>
          <button
            onClick={duplicateQuote}
            className="p-2 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            title="Duplicate quote"
          >
            <Files size={16} />
          </button>
          <button
            onClick={deleteQuote}
            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete quote"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 -mb-px">
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tabHref(tab.segment)}
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
