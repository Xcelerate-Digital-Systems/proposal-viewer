// components/admin/proposals/ProposalDetailHeader.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, ExternalLink, Trash2, BookTemplate } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { authedFetch } from '@/lib/api-fetch';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown from '@/components/ui/StatusDropdown';
import { inputClassName } from '@/components/ui/FormField';
import { Button, buttonClasses } from '@/components/ui/Button';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import {
  type ProposalStatus,
  PROPOSAL_STATUS_OPTIONS,
} from '@/lib/proposals/status';
import ProposalTabs from './ProposalTabs';

interface ProposalDetailHeaderProps {
  proposal: Proposal;
  customDomain?: string | null;
  onProposalChange?: (next: Proposal) => void;
}

export default function ProposalDetailHeader({
  proposal,
  customDomain,
  onProposalChange,
}: ProposalDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [copied, setCopied] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const templatePopoverRef = useRef<HTMLDivElement>(null);

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
      const label = PROPOSAL_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Pitch marked as ${label}`);
      onProposalChange?.({ ...proposal, status: newStatus } as Proposal);
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const res = await authedFetch(`/api/proposals/${proposal.id}/save-as-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save template');
      }
      toast.success('Template saved!');
      setShowSaveAsTemplate(false);
      setTemplateName('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
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
      router.push('/proposals');
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-edge lg:border-b-0">
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-prose transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Proposals
      </Link>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-ink font-[family-name:var(--font-display)] truncate">
              {proposal.title}
            </h1>
            <EditorSaveStatusBadge />
          </div>
          <div className="flex items-center gap-3 mt-1">
            {proposal.client_name && (
              <span className="text-sm text-faint">{proposal.client_name}</span>
            )}
            {proposal.description && (
              <>
                {proposal.client_name && <span className="text-edge-hover">·</span>}
                <span className="text-sm text-faint truncate max-w-[300px]">
                  {proposal.description}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusDropdown
            value={proposal.status as ProposalStatus}
            options={PROPOSAL_STATUS_OPTIONS}
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

          <div className="relative" ref={templatePopoverRef}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={BookTemplate}
              onClick={() => {
                setTemplateName(proposal.title || '');
                setShowSaveAsTemplate((v) => !v);
              }}
            >
              Save as Template
            </Button>
            {showSaveAsTemplate && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-edge shadow-popover p-4 z-50">
                <label className="block text-sm font-medium text-ink mb-1">Template Name</label>
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate(); }}
                  placeholder="e.g. Standard Website Proposal"
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
            aria-label="Delete proposal"
            onClick={deleteProposal}
            className="text-faint hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <ProposalTabs proposalId={proposal.id} />
    </div>
  );
}
