// components/admin/documents/DocumentCard.tsx
'use client';

import { useState } from 'react';
import {
  Copy, Check, Trash2, Pencil, Image, ExternalLink, FileText,
} from 'lucide-react';
import { supabase, Document as DocType } from '@/lib/supabase';
import { buildDocumentUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { PageEditor } from '../page-editor';
import DocumentCoverEditor from './DocumentCoverEditor';

interface DocumentCardProps {
  document: DocType;
  onRefresh: () => void;
  customDomain?: string | null;
}

type ActiveTab = 'pages' | 'cover' | null;

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
  { key: 'cover', label: 'Cover', icon: <Image size={14} /> },
];

export default function DocumentCard({ document: doc, onRefresh, customDomain }: DocumentCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);

  const toggleTab = (tab: ActiveTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const copyLink = () => {
    const url = buildDocumentUrl(doc.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const deleteDocument = async () => {
    const ok = await confirm({
      title: 'Delete Document',
      message: `Delete "${doc.title}"? This will remove the PDF permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await supabase.storage.from('proposals').remove([doc.file_path]);
    if (doc.cover_image_path) {
      await supabase.storage.from('proposals').remove([doc.cover_image_path]);
    }
    await supabase.from('documents').delete().eq('id', doc.id);
    toast.success('Document deleted');
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
                {doc.title}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                <FileText size={14} /> Document
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {doc.description && (
                <>
                  <span className="truncate max-w-[200px]">{doc.description}</span>
                  <span className="text-gray-200">&middot;</span>
                </>
              )}
              <span>{formatSize(doc.file_size_bytes)}</span>
              <span className="text-gray-200">&middot;</span>
              <span>{formatDate(doc.created_at)}</span>
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

            <a
              href={`/doc/${doc.share_token}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
            >
              <ExternalLink size={13} />
              Preview
            </a>

            <button
              onClick={deleteDocument}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete document"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Content ───────────────────────────────────────────── */}
      {activeTab === 'pages' && (
        <PageEditor
          proposalId={doc.id}
          filePath={doc.file_path}
          initialPageNames={doc.page_names || []}
          onSave={() => { setActiveTab(null); onRefresh(); }}
          onCancel={() => setActiveTab(null)}
          tableName="documents"
        />
      )}

      {activeTab === 'cover' && (
        <DocumentCoverEditor
          document={doc}
          onSave={() => { setActiveTab(null); onRefresh(); }}
          onCancel={() => setActiveTab(null)}
        />
      )}
    </div>
  );
}