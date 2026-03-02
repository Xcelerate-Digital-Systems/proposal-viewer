// components/admin/templates/TemplateListCard.tsx
'use client';

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TemplateListCard({ template: t, onRefresh, onCreateProposal }: TemplateListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

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
      .from('template_pages')
      .select('file_path')
      .eq('template_id', t.id);

    if (pages && pages.length > 0) {
      const paths = pages.map((p) => p.file_path).filter(Boolean);
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
      {/* ─── Visual header — click to open ──────────────────── */}
      <button
        onClick={() => router.push(`/templates/${t.id}/pages`)}
        className="w-full aspect-[4/3] rounded-t-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-5 border-b border-gray-100"
      >
        {t.page_count > 0 ? (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-gray-800">{t.page_count}</span>
              <span className="text-sm text-gray-400 font-medium">page{t.page_count !== 1 ? 's' : ''}</span>
            </div>
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
          {formatDate(t.created_at)}
        </span>
      </button>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        {/* Name */}
        <h3
          className="text-sm font-semibold font-[family-name:var(--font-display)] text-gray-900 truncate cursor-pointer hover:text-[#017C87] transition-colors mb-1"
          onClick={() => router.push(`/templates/${t.id}/pages`)}
        >
          {t.name}
        </h3>

        {/* Description */}
        {t.description && (
          <p className="text-[11px] text-gray-400 truncate mb-2.5">
            {t.description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ─── Actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push(`/templates/${t.id}/pages`)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
            >
              <Eye size={12} />
              Open
            </button>
            <a
              href={`/template-preview/${t.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </a>
            {onCreateProposal && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateProposal(t.id); }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Plus size={12} />
                Use
              </button>
            )}
          </div>

          <button
            onClick={deleteTemplate}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete template"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}