// components/admin/documents/DocumentListRow.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Trash2, ExternalLink, FileText } from 'lucide-react';
import { supabase, type Document as DocType } from '@/lib/supabase';
import { buildDocumentUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentListRowProps {
  document: DocType;
  onRefresh: () => void;
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
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

export default function DocumentListRow({ document: doc, onRefresh, customDomain }: DocumentListRowProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const pageCount = getPageCount(doc);

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
    <div
      onClick={() => router.push(`/documents/${doc.id}/pages`)}
      className="flex items-center gap-4 px-4 py-3 bg-white rounded-[12px] border border-edge hover:border-edge-hover cursor-pointer transition-colors group"
    >
      {/* Document badge */}
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 bg-surface text-muted">
        <FileText size={12} />
        Document
      </span>

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
          {doc.title}
        </h3>
        {doc.description && (
          <p className="text-xs text-faint truncate">{doc.description}</p>
        )}
      </div>

      {/* Page count */}
      <span className="text-xs text-faint shrink-0 hidden sm:block w-16 text-right">
        {pageCount} page{pageCount !== 1 ? 's' : ''}
      </span>

      {/* Date */}
      <span className="text-xs text-faint shrink-0 hidden md:block w-16 text-right">
        {formatDate(doc.created_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
          title="Copy link"
        >
          {copied ? <Check size={14} className="text-[#2E7D32]" /> : <Copy size={14} />}
        </button>
        <a
          href={`/doc/${doc.share_token}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
          title="Preview"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={deleteDocument}
          className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}