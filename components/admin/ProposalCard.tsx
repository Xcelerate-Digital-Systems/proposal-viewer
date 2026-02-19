// components/admin/ProposalCard.tsx
'use client';

import { useState } from 'react';
import {
  Link2, Eye, CheckCircle2, Clock, FileText, Copy, Check,
  Trash2, X, Pencil, Image
} from 'lucide-react';
import { supabase, Proposal } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import PageEditor from './PageEditor';
import CoverEditor from './CoverEditor';

interface ProposalCardProps {
  proposal: Proposal;
  onRefresh: () => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  draft: { icon: <FileText size={14} />, color: 'bg-[#1a1a1a] text-[#999]', label: 'Draft' },
  sent: { icon: <Clock size={14} />, color: 'bg-blue-900/30 text-blue-400', label: 'Sent' },
  viewed: { icon: <Eye size={14} />, color: 'bg-amber-900/30 text-amber-400', label: 'Viewed' },
  accepted: { icon: <CheckCircle2 size={14} />, color: 'bg-emerald-900/30 text-emerald-400', label: 'Accepted' },
  declined: { icon: <X size={14} />, color: 'bg-red-900/30 text-red-400', label: 'Declined' },
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return '\u2014';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: string | null) => {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ProposalCard({ proposal: p, onRefresh }: ProposalCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [editingPages, setEditingPages] = useState(false);
  const [editingCover, setEditingCover] = useState(false);

  const sc = statusConfig[p.status];

  const copyLink = () => {
    const url = `${window.location.origin}/view/${p.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const markAsSent = async () => {
    await supabase.from('proposals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', p.id);
    toast.success('Proposal marked as sent');
    onRefresh();
  };

  const deleteProposal = async () => {
    const ok = await confirm({
      title: 'Delete Proposal',
      message: `Delete "${p.title}"? This will remove the PDF and all associated data permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await supabase.storage.from('proposals').remove([p.file_path]);
    await supabase.from('proposals').delete().eq('id', p.id);
    toast.success('Proposal deleted');
    onRefresh();
  };

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden hover:border-[#333] transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-semibold font-[family-name:var(--font-display)] truncate text-white">
                {p.title}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.icon} {sc.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-[#666]">
              <span>{p.client_name}</span>
              <span className="text-[#333]">&middot;</span>
              <span>{formatSize(p.file_size_bytes)}</span>
              <span className="text-[#333]">&middot;</span>
              <span>{formatDate(p.created_at)}</span>
              {p.accepted_at && (
                <>
                  <span className="text-[#333]">&middot;</span>
                  <span className="text-emerald-400 font-medium">
                    Accepted {formatDate(p.accepted_at)}
                    {p.accepted_by_name && ` by ${p.accepted_by_name}`}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
            >
              {copiedId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedId ? 'Copied!' : 'Copy Link'}
            </button>
            {p.status === 'draft' && (
              <button
                onClick={markAsSent}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 transition-colors"
              >
                <Link2 size={14} />
                Mark Sent
              </button>
            )}
            <button
              onClick={() => { setEditingCover(!editingCover); setEditingPages(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
            >
              <Image size={14} />
              Cover
            </button>
            <button
              onClick={() => { setEditingPages(!editingPages); setEditingCover(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
            >
              <Pencil size={14} />
              Edit Pages
            </button>
            <a
              href={`/view/${p.share_token}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors"
            >
              <Eye size={14} />
              Preview
            </a>
            <button
              onClick={deleteProposal}
              className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {editingCover && (
        <CoverEditor
          proposal={p}
          onSave={() => { setEditingCover(false); onRefresh(); }}
          onCancel={() => setEditingCover(false)}
        />
      )}

      {editingPages && (
        <PageEditor
          proposalId={p.id}
          filePath={p.file_path}
          initialPageNames={p.page_names || []}
          onSave={() => { setEditingPages(false); onRefresh(); }}
          onCancel={() => setEditingPages(false)}
        />
      )}
    </div>
  );
}