// components/admin/documents/DocumentListCard.tsx
'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Eye } from 'lucide-react';
import { supabase, type Document as DocType } from '@/lib/supabase';
import { buildDocumentUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EntityCard from '@/components/admin/EntityCard';
import { formatSize, pageCountFromPageNames } from '@/lib/entity-card-helpers';

interface DocumentListCardProps {
  document: DocType;
  onRefresh: () => void;
  customDomain?: string | null;
}

export default function DocumentListCard({ document: doc, onRefresh, customDomain }: DocumentListCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const href = `/documents/${doc.id}/pages`;

  const copyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = buildDocumentUrl(doc.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
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
    <EntityCard
      href={href}
      title={doc.title}
      subtitle={doc.description}
      coverDescription={doc.description}
      cover={{
        enabled: !!doc.cover_enabled,
        imagePath: doc.cover_image_path ?? null,
        bgStyle: doc.cover_bg_style ?? null,
        bgColor1: doc.cover_bg_color_1 ?? null,
        bgColor2: doc.cover_bg_color_2 ?? null,
        gradientType: doc.cover_gradient_type ?? null,
        gradientAngle: doc.cover_gradient_angle ?? null,
        overlayOpacity: doc.cover_overlay_opacity ?? null,
        textColor: doc.cover_text_color ?? null,
        subtitleColor: doc.cover_subtitle_color ?? null,
      }}
      pageCount={pageCountFromPageNames(doc.page_names)}
      fileSize={formatSize(doc.file_size_bytes)}
      createdAt={doc.created_at}
      aspectRatio="4/3"
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
            {copied ? <Check size={12} className="text-[#2E7D32]" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Link'}
          </button>
          <a
            href={`/doc/${doc.share_token}`}
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
      deleteTitle="Delete document"
    />
  );
}
