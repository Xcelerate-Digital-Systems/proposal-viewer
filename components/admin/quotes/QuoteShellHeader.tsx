// components/admin/quotes/QuoteShellHeader.tsx
// Three-tab header for the independent /quotes detail area:
//   Builder  → /quotes/[id]
//   Cover    → /quotes/[id]/cover
//   Settings → /quotes/[id]/settings
//
// Mirrors QuoteDetailHeader's status/copy/preview/duplicate/delete actions
// but routes to the new /quotes paths instead of /proposals/[id]/quote-*.
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Check, ExternalLink, Trash2, Download, BookmarkPlus,
  PenLine, Paintbrush, SlidersHorizontal, Files, CheckSquare,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { formatQuoteNumber } from '@/lib/quote-number';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown from '@/components/ui/StatusDropdown';
import { inputClassName } from '@/components/ui/FormField';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';
import { Button, buttonClasses } from '@/components/ui/Button';
import {
  type ProposalStatus,
  PROPOSAL_STATUS_OPTIONS,
} from '@/lib/proposals/status';

interface QuoteShellHeaderProps {
  proposal: Proposal;
  customDomain?: string | null;
  onProposalChange?: (next: Proposal) => void;
}

const statusOptions = PROPOSAL_STATUS_OPTIONS;

const tabs = [
  { key: 'cover',    label: 'Cover',    icon: Paintbrush,        segment: 'cover' },
  { key: '',         label: 'Builder',  icon: PenLine,           segment: '' },
  { key: 'settings', label: 'Design',   icon: SlidersHorizontal, segment: 'settings' },
  { key: 'decision', label: 'Decision', icon: CheckSquare,       segment: 'decision' },
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
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const templatePopoverRef = useRef<HTMLDivElement>(null);
  const activeKey = activeKeyFromPath(pathname);

  const closeTemplatePopover = useCallback(() => {
    setShowSaveAsTemplate(false);
  }, []);

  useEffect(() => {
    if (!showSaveAsTemplate) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTemplatePopover();
    };
    const handleClick = (e: MouseEvent) => {
      if (templatePopoverRef.current && !templatePopoverRef.current.contains(e.target as Node)) {
        closeTemplatePopover();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showSaveAsTemplate, closeTemplatePopover]);

  const quoteNumberFormat = companyInfo
    ? { prefix: companyInfo.quoteNumberPrefix, padWidth: companyInfo.quoteNumberPadWidth }
    : undefined;

  const copyLink = () => {
    const url = buildProposalUrl(proposal.share_token, customDomain ?? null, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: ProposalStatus) => {
    if (newStatus === 'draft' && proposal.status !== 'draft') {
      const ok = await confirm({
        title: 'Revert to Draft?',
        message: 'This will reset the sent date and view tracking for this quote. This cannot be undone.',
        confirmLabel: 'Revert to Draft',
        destructive: true,
      });
      if (!ok) return;
    }
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

  const handleSaveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/quotes/${proposal.id}/save-as-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(`Saved as "${json.name}"`);
      setShowSaveAsTemplate(false);
      setTemplateName('');
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
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-edge lg:border-b-0">
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-prose transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Quotes
      </Link>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-xl font-semibold text-ink font-[family-name:var(--font-display)] truncate">
              {proposal.title}
            </h1>
            {formatQuoteNumber(proposal.quote_number, quoteNumberFormat) && (
              <span className="text-detail font-medium text-faint tabular-nums shrink-0">
                {formatQuoteNumber(proposal.quote_number, quoteNumberFormat)}
              </span>
            )}
            {proposal.is_test && (
              <span className="px-2 py-0.5 rounded-lg text-2xs font-semibold bg-status-test-tint text-status-test border border-status-test-border shrink-0">
                Test
              </span>
            )}
            <EditorSaveStatusBadge />
          </div>
          <div className="flex items-center gap-3 mt-1">
            {proposal.client_name && (
              <span className="text-sm text-faint">{proposal.client_name}</span>
            )}
            {proposal.category && (
              <>
                <span className="text-edge-hover">·</span>
                <span className="text-sm text-faint">{proposal.category}</span>
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
          <div className="relative" ref={templatePopoverRef}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon={BookmarkPlus}
              onClick={() => {
                setTemplateName(proposal.title || '');
                setShowSaveAsTemplate((v) => !v);
              }}
              aria-label="Save as template"
              title="Save as template"
            />
            {showSaveAsTemplate && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-edge shadow-popover p-4 z-50">
                <label className="block text-sm font-medium text-ink mb-1">Template Name</label>
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate(); }}
                  placeholder="e.g. Standard Quote"
                  className={`${inputClassName} mb-3`}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowSaveAsTemplate(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAsTemplate}
                    loading={savingTemplate}
                    disabled={!templateName.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon={Files}
            onClick={duplicateQuote}
            aria-label="Duplicate quote"
            title="Duplicate quote"
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon={Trash2}
            onClick={deleteQuote}
            aria-label="Delete quote"
            title="Delete quote"
            className="hover:!text-red-500 hover:!bg-red-50"
          />
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
                  : 'border-transparent text-dim hover:text-prose hover:border-edge-hover'
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
