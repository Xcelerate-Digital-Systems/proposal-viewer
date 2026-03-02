// components/admin/documents/DocumentListCard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Trash2, ExternalLink, Eye, FolderOpen } from 'lucide-react';
import { supabase, type Document as DocType } from '@/lib/supabase';
import { buildDocumentUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentListCardProps {
  document: DocType;
  onRefresh: () => void;
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getPageCount = (doc: DocType): number => {
  if (Array.isArray(doc.page_names)) {
    return doc.page_names.filter((pn) =>
      typeof pn === 'string' || (typeof pn === 'object' && pn.type !== 'group')
    ).length;
  }
  return 0;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DocumentListCard({ document: doc, onRefresh, customDomain }: DocumentListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const pageCount = getPageCount(doc);
  const size = formatSize(doc.file_size_bytes);

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildDocumentUrl(doc.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteDocument = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Document deleted');
      onRefresh();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
      {/* ─── Visual header — click to open ──────────────────── */}
      <button
        onClick={() => router.push(`/documents/${doc.id}/pages`)}
        className="w-full aspect-[4/3] rounded-t-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-5 border-b border-gray-100"
      >
        {pageCount > 0 ? (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-gray-800">{pageCount}</span>
              <span className="text-sm text-gray-400 font-medium">page{pageCount !== 1 ? 's' : ''}</span>
            </div>
            {size && (
              <span className="text-xs text-gray-400">{size}</span>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[#017C87]/10 flex items-center justify-center mx-auto mb-2">
              <FolderOpen size={22} className="text-[#017C87]" />
            </div>
            <p className="text-xs text-gray-400">No pages yet</p>
          </div>
        )}

        {/* Date overlay */}
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-400 border border-gray-200/60">
          {formatDate(doc.created_at)}
        </span>
      </button>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        {/* Title */}
        <h3
          className="text-sm font-semibold font-[family-name:var(--font-display)] text-gray-900 truncate cursor-pointer hover:text-[#017C87] transition-colors mb-1"
          onClick={() => router.push(`/documents/${doc.id}/pages`)}
        >
          {doc.title}
        </h3>

        {/* Description */}
        {doc.description && (
          <p className="text-[11px] text-gray-400 truncate mb-2.5">
            {doc.description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ─── Actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push(`/documents/${doc.id}/pages`)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
            >
              <Eye size={12} />
              Open
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Link'}
            </button>
            <a
              href={`/doc/${doc.share_token}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </a>
          </div>

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
  );
}