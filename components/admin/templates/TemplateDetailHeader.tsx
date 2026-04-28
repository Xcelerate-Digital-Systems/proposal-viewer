// components/admin/templates/TemplateDetailHeader.tsx
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import TemplateTabs from './TemplateTabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateDetailHeaderProps {
  template: ProposalTemplate;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TemplateDetailHeader({ template }: TemplateDetailHeaderProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const deleteTemplate = async () => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete "${template.name}" and all its pages? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    // Delete template pages from storage
    const { data: pages } = await supabase
      .from('template_pages_v2')
      .select('payload')
      .eq('template_id', template.id);

    if (pages && pages.length > 0) {
      const paths = pages
        .map((p) => (p.payload as Record<string, unknown>)?.file_path as string | undefined)
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from('proposals').remove(paths);
      }
    }

    // Delete cover image if exists
    if (template.cover_image_path) {
      await supabase.storage.from('proposals').remove([template.cover_image_path]);
    }

    // Delete the template (cascades to pages, pricing, text pages)
    const { error } = await supabase
      .from('proposal_templates')
      .delete()
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      router.push('/templates');
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
      {/* Back link */}
      <Link
        href="/templates"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Templates
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
              {template.name}
            </h1>
            {template.entity_type === 'quote' && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                Quote Template
              </span>
            )}
            <EditorSaveStatusBadge />
          </div>
          {template.description && (
            <p className="text-sm text-gray-400 mt-1 truncate max-w-[400px]">
              {template.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Page count badge */}
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 bg-gray-100 border border-gray-200">
            {template.page_count} page{template.page_count !== 1 ? 's' : ''}
          </span>

          {/* Preview */}
          <a
            href={`/template-preview/${template.id}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-teal hover:bg-teal/5 border border-teal/20 transition-colors"
          >
            <ExternalLink size={14} />
            Preview
          </a>

          {/* Delete */}
          <button
            onClick={deleteTemplate}
            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete template"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <TemplateTabs templateId={template.id} />
    </div>
  );
}
