// components/admin/templates/TemplateListCard.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink, Eye, Plus } from 'lucide-react';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EntityCard from '@/components/admin/EntityCard';

interface TemplateListCardProps {
  template: ProposalTemplate;
  onRefresh: () => void;
  onCreateProposal?: (templateId: string) => void;
}

export default function TemplateListCard({ template: t, onRefresh, onCreateProposal }: TemplateListCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const href = `/templates/${t.id}/pages`;

  const handleDelete = async () => {
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
      .eq('template_id', t.id);

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
    <EntityCard
      href={href}
      title={t.name}
      subtitle={t.description}
      coverDescription={t.description}
      cover={{
        enabled: !!t.cover_enabled,
        imagePath: t.cover_image_path ?? null,
        bgStyle: t.cover_bg_style ?? null,
        bgColor1: t.cover_bg_color_1 ?? null,
        bgColor2: t.cover_bg_color_2 ?? null,
        gradientType: t.cover_gradient_type ?? null,
        gradientAngle: t.cover_gradient_angle ?? null,
        overlayOpacity: t.cover_overlay_opacity ?? null,
        textColor: t.cover_text_color ?? null,
        subtitleColor: t.cover_subtitle_color ?? null,
      }}
      pageCount={t.page_count}
      createdAt={t.created_at}
      bodyTitleBadge={t.entity_type === 'quote' ? (
        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
          Quote
        </span>
      ) : null}
      actions={
        <>
          <button
            onClick={() => router.push(href)}
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
        </>
      }
      onDelete={handleDelete}
      deleteTitle="Delete template"
    />
  );
}
