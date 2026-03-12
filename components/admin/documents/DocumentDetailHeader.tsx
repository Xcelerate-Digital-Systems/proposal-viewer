// components/admin/documents/DocumentDetailHeader.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { supabase, type Document as DocType } from '@/lib/supabase';
import { buildDocumentUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DocumentTabs from './DocumentTabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentDetailHeaderProps {
  documentId: string;
  activeTab: 'pages' | 'text-pages' | 'contents' | 'cover' | 'design' | 'details';
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DocumentDetailHeader({
  documentId,
  activeTab,
  customDomain,
}: DocumentDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [doc, setDoc] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  /* ── Fetch document ─────────────────────────────────────────── */

  const fetchDocument = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (data) setDoc(data);
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  /* ── Actions ────────────────────────────────────────────────── */

  const copyLink = () => {
    if (!doc) return;
    const url = buildDocumentUrl(doc.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const deleteDocument = async () => {
    if (!doc) return;
    const ok = await confirm({
      title: 'Delete Document',
      message: `Delete "${doc.title}"? This will remove the PDF permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    // Clean up storage
    await supabase.storage.from('proposals').remove([doc.file_path]);
    if (doc.cover_image_path) {
      await supabase.storage.from('proposals').remove([doc.cover_image_path]);
    }

    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) {
      toast.error('Failed to delete document');
    } else {
      toast.success('Document deleted');
      router.push('/documents');
    }
  };

  /* ── Loading skeleton ───────────────────────────────────────── */

  if (loading || !doc) {
    return (
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        <div className="inline-flex items-center gap-1.5 text-sm text-gray-400 mb-3">
          <ArrowLeft size={14} />
          All Documents
        </div>
        <div className="animate-pulse">
          <div className="h-7 w-64 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-40 bg-gray-100 rounded mb-4" />
          <div className="h-10 w-full bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
      {/* Back link */}
      <Link
        href="/documents"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Documents
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
            {doc.title}
          </h1>
          {doc.description && (
            <p className="text-sm text-gray-400 mt-1 truncate max-w-[400px]">
              {doc.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {/* Preview */}
          <a
            href={`/doc/${doc.share_token}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-teal hover:bg-teal/5 border border-teal/20 transition-colors"
          >
            <ExternalLink size={14} />
            Preview
          </a>

          {/* Delete */}
          <button
            onClick={deleteDocument}
            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete document"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <DocumentTabs documentId={documentId} activeTab={activeTab} />
    </div>
  );
}