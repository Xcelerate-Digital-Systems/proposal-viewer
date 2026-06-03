// components/admin/proposals/ProposalListCard.tsx
'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Eye } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown from '@/components/ui/StatusDropdown';
import EntityCard from '@/components/admin/EntityCard';
import { formatSize, pageCountFromPageNames } from '@/lib/entity-card-helpers';
import {
  type ProposalStatus,
  PROPOSAL_STATUS_OPTIONS,
} from '@/lib/proposals/status';

interface ProposalListCardProps {
  proposal: Proposal;
  onRefresh: () => void;
  customDomain?: string | null;
  /** Override the destination route. Default routes proposals to /proposals/[id]/pages
   *  and quotes to /proposals/[id]/quote-pricing. The /quotes area passes /quotes/[id]. */
  hrefOverride?: string;
}

export default function ProposalListCard({ proposal: p, onRefresh, customDomain, hrefOverride }: ProposalListCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const href = hrefOverride ?? (p.entity_type === 'quote'
    ? `/proposals/${p.id}/quote-pricing`
    : `/proposals/${p.id}/pages`);

  const copyLink = (e: React.MouseEvent) => {
    e.preventDefault();
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
      toast.success(`Marked as ${PROPOSAL_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label}`);
      onRefresh();
    }
  };

  const handleDelete = async () => {
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

  const subtitle = [p.client_name, p.description].filter(Boolean).join(' · ') || null;

  return (
    <EntityCard
      href={href}
      title={p.title}
      subtitle={subtitle}
      cover={{
        enabled: !!p.cover_enabled,
        imagePath: p.cover_image_path ?? null,
        bgStyle: p.cover_bg_style ?? null,
        bgColor1: p.cover_bg_color_1 ?? null,
        bgColor2: p.cover_bg_color_2 ?? null,
        gradientType: p.cover_gradient_type ?? null,
        gradientAngle: p.cover_gradient_angle ?? null,
        overlayOpacity: p.cover_overlay_opacity ?? null,
        textColor: p.cover_text_color ?? null,
        subtitleColor: p.cover_subtitle_color ?? null,
      }}
      pageCount={pageCountFromPageNames(p.page_names)}
      fileSize={formatSize(p.file_size_bytes)}
      createdAt={p.created_at}
      coverTopLeftBadge={p.entity_type === 'quote' ? (
        <span className="px-2 py-0.5 rounded-lg bg-amber-50/90 backdrop-blur-sm text-2xs font-semibold text-amber-600 border border-amber-200">
          Quote
        </span>
      ) : null}
      body={
        <StatusDropdown
          value={p.status as ProposalStatus}
          options={PROPOSAL_STATUS_OPTIONS}
          onChange={handleStatusChange}
        />
      }
      actions={
        <>
          <a
            href={href}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal-tint transition-colors"
          >
            <Eye size={12} />
            Open
          </a>
          <button
            onClick={copyLink}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Link'}
          </button>
          <a
            href={`/view/${p.share_token}`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <ExternalLink size={12} />
            Preview
          </a>
        </>
      }
      onDelete={handleDelete}
      deleteTitle="Delete proposal"
    />
  );
}
