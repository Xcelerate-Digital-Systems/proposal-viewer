// components/admin/documents/DocumentListCard.tsx
'use client';

import { useState, useEffect } from 'react';
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

function buildCoverBg(doc: DocType): { backgroundColor?: string; backgroundImage?: string } {
  const style = doc.cover_bg_style || 'gradient';
  const c1 = doc.cover_bg_color_1 || '#0f0f0f';
  const c2 = doc.cover_bg_color_2 || '#141414';
  if (style === 'solid') return { backgroundColor: c1 };
  const type = doc.cover_gradient_type || 'linear';
  const angle = doc.cover_gradient_angle ?? 135;
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

export default function DocumentListCard({ document: doc, onRefresh, customDomain }: DocumentListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (doc.cover_enabled && doc.cover_image_path) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(doc.cover_image_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setCoverImageUrl(data.signedUrl);
        });
    }
  }, [doc.cover_enabled, doc.cover_image_path]);

  const pageCount = getPageCount(doc);
  const size = formatSize(doc.file_size_bytes);
  const hasCover = doc.cover_enabled;

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
    <div className="bg-white rounded-[14px] border border-edge hover:border-edge-hover transition-colors flex flex-col">
      {/* ─── Visual header — click to open ──────────────────── */}
      <button
        onClick={() => router.push(`/documents/${doc.id}/pages`)}
        className="w-full aspect-[4/3] rounded-t-[14px] overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative border-b border-edge"
        style={hasCover ? { backgroundColor: doc.cover_bg_color_1 || '#0f0f0f' } : undefined}
      >
        {hasCover ? (
          <>
            {/* Background gradient / solid */}
            <div className="absolute inset-0" style={buildCoverBg(doc)} />

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
                      doc.cover_bg_color_1 || '#0f0f0f',
                      doc.cover_overlay_opacity ?? 0.65
                    ),
                  }}
                />
              </>
            )}

            {/* Mini cover content */}
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <h4
                className="text-sm font-semibold leading-snug line-clamp-2"
                style={{ color: doc.cover_text_color || '#ffffff' }}
              >
                {doc.title}
              </h4>
              {doc.description && (
                <p
                  className="text-[11px] mt-1 opacity-70 truncate"
                  style={{ color: doc.cover_subtitle_color || doc.cover_text_color || '#ffffff' }}
                >
                  {doc.description}
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
          {formatDate(doc.created_at)}
        </span>
      </button>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        <h3
          className="text-[15px] font-semibold text-ink truncate cursor-pointer hover:text-teal transition-colors mb-1"
          onClick={() => router.push(`/documents/${doc.id}/pages`)}
        >
          {doc.title}
        </h3>

        {doc.description && (
          <p className="text-[12px] text-faint truncate mb-2.5">
            {doc.description}
          </p>
        )}

        <div className="flex-1" />

        {/* ─── Actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-edge pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push(`/documents/${doc.id}/pages`)}
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
              href={`/doc/${doc.share_token}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </a>
          </div>

          <button
            onClick={deleteDocument}
            className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete document"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}