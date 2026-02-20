// components/admin/ProposalCard.tsx
'use client';

import { useState } from 'react';
import {
  Link2, Eye, CheckCircle2, Clock, FileText, Copy, Check,
  Trash2, X, Pencil, Image
} from 'lucide-react';
import { supabase, Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import PageEditor from './PageEditor';
import CoverEditor from './CoverEditor';

interface ProposalCardProps {
  proposal: Proposal;
  onRefresh: () => void;
  customDomain?: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  draft: { icon: <FileText size={14} />, color: 'bg-gray-100 text-gray-500', label: 'Draft' },
  sent: { icon: <Clock size={14} />, color: 'bg-blue-50 text-blue-600', label: 'Sent' },
  viewed: { icon: <Eye size={14} />, color: 'bg-amber-50 text-amber-600', label: 'Viewed' },
  accepted: { icon: <CheckCircle2 size={14} />, color: 'bg-emerald-50 text-emerald-600', label: 'Accepted' },
  declined: { icon: <X size={14} />, color: 'bg-red-50 text-red-500', label: 'Declined' },
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

export default function ProposalCard({ proposal: p, onRefresh, customDomain }: ProposalCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [editingPages, setEditingPages] = useState(false);
  const [editingCover, setEditingCover] = useState(false);

  const sc = statusConfig[p.status];

  const copyLink = () => {
    const url = buildProposalUrl(p.share_token, customDomain, window.location.origin);
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 shadow-sm transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-semibold font-[family-name:var(--font-display)] truncate text-gray-900">
                {p.title}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.icon} {sc.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{p.client_name}</span>
              <span className="text-gray-200">&middot;</span>
              <span>{formatSize(p.file_size_bytes)}</span>
              <span className="text-gray-200">&middot;</span>
              <span>{formatDate(p.created_at)}</span>
              {p.accepted_at && (
                <>
                  <span className="text-gray-200">&middot;</span>
                  <span className="text-emerald-600 font-medium">
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copiedId ? 'Copied!' : 'Copy Link'}
            </button>
            {p.status === 'draft' && (
              <button
                onClick={markAsSent}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Link2 size={14} />
                Mark Sent
              </button>
            )}
            <button
              onClick={() => { setEditingCover(!editingCover); setEditingPages(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <Image size={14} />
              Cover
            </button>
            <button
              onClick={() => { setEditingPages(!editingPages); setEditingCover(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <Pencil size={14} />
              Edit Pages
            </button>
            <a
              href={`/view/${p.share_token}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors"
            >
              <Eye size={14} />
              Preview
            </a>
            <button
              onClick={deleteProposal}
              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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