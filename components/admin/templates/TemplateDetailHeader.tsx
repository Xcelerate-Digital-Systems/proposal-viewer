// components/admin/templates/TemplateDetailHeader.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Trash2, Copy } from 'lucide-react';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { authedFetch } from '@/lib/api-fetch';
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
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const duplicateTemplate = async () => {
    setDuplicating(true);
    try {
      const res = await authedFetch('/api/templates/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || 'Failed to duplicate template');
        return;
      }
      const { template_id } = await res.json();
      toast.success('Template duplicated');
      router.push(`/templates/${template_id}/pages`);
    } catch {
      toast.error('Failed to duplicate template');
    } finally {
      setDuplicating(false);
    }
  };

  const deleteTemplate = async () => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete "${template.name}" and all its pages? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
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

      if (template.cover_image_path) {
        await supabase.storage.from('proposals').remove([template.cover_image_path]);
      }

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
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-ivory px-6 lg:px-10 pt-6 pb-0 border-b border-edge lg:border-b-0">
      {/* Back link */}
      <Link
        href="/templates"
        className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-prose transition-colors mb-3"
      >
        <ArrowLeft size={14} />
        All Templates
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-ink font-[family-name:var(--font-display)] truncate">
              {template.name}
            </h1>
            {template.entity_type === 'quote' && (
              <span className="px-2 py-0.5 rounded-lg text-detail font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                Quote Template
              </span>
            )}
            <EditorSaveStatusBadge />
          </div>
          {template.description && (
            <p className="text-sm text-faint mt-1 truncate max-w-[400px]">
              {template.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-dim bg-surface border border-edge-strong">
            {template.page_count} page{template.page_count !== 1 ? 's' : ''}
          </span>

          <a
            href={`/template-preview/${template.id}`}
            target="_blank"
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink size={14} />
            Preview
          </a>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={Copy}
            loading={duplicating}
            onClick={duplicateTemplate}
          >
            Duplicate
          </Button>

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Delete template"
            loading={deleting}
            onClick={deleteTemplate}
            className="text-faint hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <TemplateTabs templateId={template.id} entityType={template.entity_type} />
    </div>
  );
}
