// components/admin/proposals/ProposalListCard.tsx
'use client';

import { useState, useEffect } from 'react';
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
  { value: 'draft',    label: 'Draft',    bg: 'bg-surface',    text: 'text-muted',   border: 'border-edge',   icon: <FileText size={12} /> },
  { value: 'sent',     label: 'Sent',     bg: 'bg-teal-tint',    text: 'text-teal',   border: 'border-teal/20',icon: <Clock size={12} /> },
  { value: 'viewed',   label: 'Viewed',   bg: 'bg-[#FFF8E1]',    text: 'text-[#E6A817]',   border: 'border-[#E6A817]/20',icon: <Eye size={12} /> },
  { value: 'revision_requested', label: 'Changes Requested', bg: 'bg-[#FFF8E1]', text: 'text-[#E6A817]', border: 'border-[#E6A817]/20', icon: <PenLine size={13} /> },
  { value: 'accepted', label: 'Accepted', bg: 'bg-[#E8F5E9]',    text: 'text-[#2E7D32]',   border: 'border-[#2E7D32]/20',icon: <CheckCircle2 size={12} /> },
  { value: 'declined', label: 'Declined', bg: 'bg-red-50',        text: 'text-red-500',     border: 'border-red-200',     icon: <X size={12} /> },
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

function buildCoverBg(p: Proposal): { backgroundColor?: string; backgroundImage?: string } {
  const style = p.cover_bg_style || 'gradient';
  const c1 = p.cover_bg_color_1 || '#0f0f0f';
  const c2 = p.cover_bg_color_2 || '#141414';
  if (style === 'solid') return { backgroundColor: c1 };
  const type = p.cover_gradient_type || 'linear';
  const angle = p.cover_gradient_angle ?? 135;
  if (type === 'radial') return { backgroundImage: `radial-gradient(circle, ${c1}, ${c2})` };
  if (type === 'conic') return { backgroundImage: `conic-gradient(from ${angle}deg, ${c1}, ${c2})` };
  return { backgroundImage: `linear-gradient(${angle}deg, ${c1}, ${c2})` };
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProposalListCard({ proposal: p, onRefresh, customDomain }: ProposalListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (p.cover_enabled && p.cover_image_path) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(p.cover_image_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setCoverImageUrl(data.signedUrl);
        });
    }
  }, [p.cover_enabled, p.cover_image_path]);

  const pageCount = getPageCount(p);
  const size = formatSize(p.file_size_bytes);
  const hasCover = p.cover_enabled;

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
    <div className="bg-white rounded-[14px] border border-edge hover:border-edge-hover transition-colors flex flex-col">
      {/* ─── Visual header — click to open ──────────────────── */}
      <button
        onClick={() => router.push(`/proposals/${p.id}/pages`)}
        className="w-full aspect-[4/3] rounded-t-[14px] overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative border-b border-edge"
        style={hasCover ? { backgroundColor: p.cover_bg_color_1 || '#0f0f0f' } : undefined}
      >
        {hasCover ? (
          <>
            {/* Background gradient / solid */}
            <div className="absolute inset-0" style={buildCoverBg(p)} />

            {/* Background image */}
            {coverImageUrl && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverImageUrl})` }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: hexToRgba(
                      p.cover_bg_color_1 || '#0f0f0f',
                      p.cover_overlay_opacity ?? 0.65
                    ),
                  }}
                />
              </>
            )}

            {/* Mini cover content */}
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <h4
                className="text-sm font-semibold leading-snug line-clamp-2"
                style={{ color: p.cover_text_color || '#ffffff' }}
              >
                {p.title}
              </h4>
              {p.client_name && (
                <p
                  className="text-[11px] mt-1 opacity-70 truncate"
                  style={{ color: p.cover_subtitle_color || p.cover_text_color || '#ffffff' }}
                >
                  {p.client_name}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center p-5">
            {pageCount > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-ink">{pageCount}</span>
                  <span className="text-sm text-faint font-medium">page{pageCount !== 1 ? 's' : ''}</span>
                </div>
                {size && (
                  <span className="text-xs text-faint">{size}</span>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-teal-tint flex items-center justify-center mx-auto mb-2">
                  <FolderOpen size={22} className="text-teal" />
                </div>
                <p className="text-xs text-faint">No pages yet</p>
              </div>
            )}
          </div>
        )}

        {/* Date overlay */}
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[10px] font-medium text-faint border border-edge">
          {formatDate(p.created_at)}
        </span>
      </button>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        <h3
          className="text-[15px] font-semibold text-ink truncate cursor-pointer hover:text-teal transition-colors mb-1"
          onClick={() => router.push(`/proposals/${p.id}/pages`)}
        >
          {p.title}
        </h3>

        {(p.client_name || p.description) && (
          <p className="text-[12px] text-faint truncate mb-2.5">
            {p.client_name}
            {p.client_name && p.description && ' · '}
            {p.description}
          </p>
        )}

        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <StatusDropdown
            value={p.status as ProposalStatus}
            options={statusOptions}
            onChange={handleStatusChange}
          />
        </div>

        <div className="flex-1" />

        {/* ─── Actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-edge pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push(`/proposals/${p.id}/pages`)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal-tint transition-colors"
            >
              <Eye size={12} />
              Open
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
            >
              {copied ? <Check size={12} className="text-[#2E7D32]" /> : <Copy size={12} />}
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
          </div>

          <button
            onClick={deleteProposal}
            className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete proposal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}