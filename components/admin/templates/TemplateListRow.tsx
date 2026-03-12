// components/admin/templates/TemplateListRow.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink, Plus } from 'lucide-react';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateListRowProps {
  template: ProposalTemplate;
  onRefresh: () => void;
  onCreateProposal?: (templateId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TemplateListRow({ template: t, onRefresh, onCreateProposal }: TemplateListRowProps) {
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
    <div
      onClick={() => router.push(`/templates/${t.id}/pages`)}
      className="flex items-center gap-4 px-4 py-3 bg-white rounded-[12px] border border-edge hover:border-edge-hover cursor-pointer transition-colors group"
    >
      {/* Template icon badge */}
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 bg-teal-tint text-teal">
        Template
      </span>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
          {t.name}
        </h3>
        {t.description && (
          <p className="text-xs text-faint truncate">{t.description}</p>
        )}
      </div>

      {/* Page count */}
      <span className="text-xs text-faint shrink-0 hidden sm:block w-16 text-right">
        {t.page_count} page{t.page_count !== 1 ? 's' : ''}
      </span>

      {/* Date */}
      <span className="text-xs text-faint shrink-0 hidden md:block w-16 text-right">
        {formatDate(t.created_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {onCreateProposal && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateProposal(t.id); }}
            className="p-1.5 rounded-lg text-faint hover:text-teal hover:bg-teal-tint transition-colors"
            title="Create proposal from template"
          >
            <Plus size={14} />
          </button>
        )}
        <a
          href={`/template-preview/${t.id}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
          title="Preview"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={deleteTemplate}
          className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}