// components/admin/ProposalCard.tsx
'use client';

import { useState } from 'react';
import {
  Link2, Eye, CheckCircle2, Clock, FileText, Copy, Check,
  Trash2, X, Pencil, Image, DollarSign, ExternalLink,
} from 'lucide-react';
import { supabase, Proposal } from '@/lib/supabase';
import { buildProposalUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { PageEditor } from '../page-editor';
import CoverEditor from './CoverEditor';
import PricingTab from './PricingTab';

interface ProposalCardProps {
  proposal: Proposal;
  onRefresh: () => void;
  customDomain?: string | null;
}

type ActiveTab = 'pages' | 'pricing' | 'cover' | null;

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

const tabDefs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { key: 'pages', label: 'Edit Pages', icon: <Pencil size={14} /> },
  { key: 'pricing', label: 'Pricing', icon: <DollarSign size={14} /> },
  { key: 'cover', label: 'Cover', icon: <Image size={14} /> },
];

export default function ProposalCard({ proposal: p, onRefresh, customDomain }: ProposalCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);

  const sc = statusConfig[p.status];

  const toggleTab = (tab: ActiveTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-colors hover:border-gray-300">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-4 mb-4">
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
        </div>

        {/* ─── Tab bar + Actions ──────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-200 -mx-5 px-5">
          {/* Tabs */}
          <div className="flex items-center gap-0">
            {tabDefs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => toggleTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-[#017C87] text-[#017C87]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 pb-1.5">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {copiedId ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copiedId ? 'Copied!' : 'Copy Link'}
            </button>

            {p.status === 'draft' && (
              <button
                onClick={markAsSent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Link2 size={13} />
                Mark Sent
              </button>
            )}

            <a
              href={`/view/${p.share_token}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
            >
              <ExternalLink size={13} />
              Preview
            </a>

            <button
              onClick={deleteProposal}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete proposal"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Content ───────────────────────────────────────────── */}
      {activeTab === 'pages' && (
        <PageEditor
          proposalId={p.id}
          filePath={p.file_path}
          initialPageNames={p.page_names || []}
          onSave={() => { setActiveTab(null); onRefresh(); }}
          onCancel={() => setActiveTab(null)}
        />
      )}

      {activeTab === 'pricing' && (
        <PricingTab proposalId={p.id} />
      )}

      {activeTab === 'cover' && (
        <CoverEditor
          proposal={p}
          onSave={() => { setActiveTab(null); onRefresh(); }}
          onCancel={() => setActiveTab(null)}
        />
      )}
    </div>
  );
}