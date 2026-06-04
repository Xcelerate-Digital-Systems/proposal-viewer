// components/admin/documents/DocumentDetailHeader.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { supabase, type Document as DocType } from '@/lib/supabase';
import { buildDocumentUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import DocumentTabs from './DocumentTabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentDetailHeaderProps {
  document: DocType;
  customDomain?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DocumentDetailHeader({
  document: doc,
  customDomain,
}: DocumentDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = buildDocumentUrl(doc.share_token, customDomain ?? null, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const deleteDocument = async () => {
    const ok = await confirm({
      title: 'Delete Doc',
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
      toast.error('Failed to delete doc');
    } else {
      toast.success('Doc deleted');
      router.push('/documents');
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-edge lg:border-b-0">
      {/* Back link */}
      <Link
        href="/documents"
        className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-prose transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Documents
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-ink font-[family-name:var(--font-display)] truncate">
              {doc.title}
            </h1>
            <EditorSaveStatusBadge />
          </div>
          {doc.description && (
            <p className="text-sm text-faint mt-1 truncate max-w-[400px]">
              {doc.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-dim hover:text-prose hover:bg-surface border border-edge-strong transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
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
            className="p-2 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Delete document"
            title="Delete document"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <DocumentTabs documentId={doc.id} />
    </div>
  );
}
