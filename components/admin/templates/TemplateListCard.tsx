// components/admin/templates/TemplateListCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink, Eye, FolderOpen, Plus } from 'lucide-react';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateListCardProps {
  template: ProposalTemplate;
  onRefresh: () => void;
  onCreateProposal?: (templateId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

function buildCoverBg(t: ProposalTemplate): { backgroundColor?: string; backgroundImage?: string } {
  const style = t.cover_bg_style || 'gradient';
  const c1 = t.cover_bg_color_1 || '#0f0f0f';
  const c2 = t.cover_bg_color_2 || '#141414';
  if (style === 'solid') return { backgroundColor: c1 };
  const type = t.cover_gradient_type || 'linear';
  const angle = t.cover_gradient_angle ?? 135;
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

export default function TemplateListCard({ template: t, onRefresh, onCreateProposal }: TemplateListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (t.cover_enabled && t.cover_image_path) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(t.cover_image_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setCoverImageUrl(data.signedUrl);
        });
    }
  }, [t.cover_enabled, t.cover_image_path]);

  const hasCover = t.cover_enabled;

  const deleteTemplate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete "${t.name}" and all its pages? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    // Delete template pages from storage
    const { data: pages } = await supabase
  .from('template_pages_v2')
  .select('payload')
  .eq('template_id', t.id);  // (or template.id in TemplateDetailHeader)

if (pages && pages.length > 0) {
  const paths = pages
    .map((p) => (p.payload as Record<string, unknown>)?.file_path as string | undefined)
    .filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from('proposals').remove(paths);
      }
    }

    // Delete cover image
    if (t.cover_image_path) {
      await supabase.storage.from('proposals').remove([t.cover_image_path]);
    }

    const { error } = await supabase.from('proposal_templates').delete().eq('id', t.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Template deleted');
      onRefresh();
    }
  };

  return (
    <div className="bg-white rounded-[14px] border border-edge hover:border-edge-hover transition-colors flex flex-col">
      {/* ─── Visual header — click to open ──────────────────── */}
      <button
        onClick={() => router.push(`/templates/${t.id}/pages`)}
        className="w-full aspect-[4/3] rounded-t-[14px] overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative border-b border-edge"
        style={hasCover ? { backgroundColor: t.cover_bg_color_1 || '#0f0f0f' } : undefined}
      >
        {hasCover ? (
          <>
            <div className="absolute inset-0" style={buildCoverBg(t)} />
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
                      t.cover_bg_color_1 || '#0f0f0f',
                      t.cover_overlay_opacity ?? 0.65
                    ),
                  }}
                />
              </>
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <h4
                className="text-sm font-semibold leading-snug line-clamp-2"
                style={{ color: t.cover_text_color || '#ffffff' }}
              >
                {t.name}
              </h4>
              {t.description && (
                <p
                  className="text-[11px] mt-1 opacity-70 truncate"
                  style={{ color: t.cover_subtitle_color || t.cover_text_color || '#ffffff' }}
                >
                  {t.description}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center p-5">
            {t.page_count > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-ink">{t.page_count}</span>
                  <span className="text-sm text-faint font-medium">page{t.page_count !== 1 ? 's' : ''}</span>
                </div>
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
          {formatDate(t.created_at)}
        </span>
      </button>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        <h3
          className="text-[15px] font-semibold text-ink truncate cursor-pointer hover:text-teal transition-colors mb-1"
          onClick={() => router.push(`/templates/${t.id}/pages`)}
        >
          {t.name}
        </h3>

        {t.description && (
          <p className="text-[12px] text-faint truncate mb-2.5">
            {t.description}
          </p>
        )}

        <div className="flex-1" />

        {/* ─── Actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-edge pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push(`/templates/${t.id}/pages`)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal-tint transition-colors"
            >
              <Eye size={12} />
              Open
            </button>
            <a
              href={`/template-preview/${t.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </a>
            {onCreateProposal && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateProposal(t.id); }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
              >
                <Plus size={12} />
                Use
              </button>
            )}
          </div>

          <button
            onClick={deleteTemplate}
            className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete template"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}