// components/admin/templates/TemplateDetailHeader.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Trash2, Copy, Plus } from 'lucide-react';
import { type ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EditorSaveStatusBadge from '@/components/admin/EditorSaveStatusBadge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { authedFetch } from '@/lib/api-fetch';
import TemplateTabs from './TemplateTabs';
import { useTemplateDetail } from './TemplateDetailContext';
import { inputClassName } from '@/components/ui/FormField';

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
  const { companyId } = useTemplateDetail();
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createClientName, setCreateClientName] = useState('');
  const [creatingProposal, setCreatingProposal] = useState(false);
  const createPopoverRef = useRef<HTMLDivElement>(null);

  const closeCreatePopover = useCallback(() => {
    setShowCreateProposal(false);
  }, []);

  useEffect(() => {
    if (!showCreateProposal) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCreatePopover(); };
    const handleClick = (e: MouseEvent) => {
      if (createPopoverRef.current && !createPopoverRef.current.contains(e.target as Node)) closeCreatePopover();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, [showCreateProposal, closeCreatePopover]);

  const handleCreateProposal = async () => {
    const title = createTitle.trim();
    const clientName = createClientName.trim();
    if (!title || !clientName) return;
    setCreatingProposal(true);
    try {
      const res = await authedFetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          client_name: clientName,
          company_id: companyId,
          entity_type: template.entity_type,
          skip_default_pages: true,
          cover_enabled:                  template.cover_enabled ?? true,
          cover_subtitle:                 template.cover_subtitle || null,
          cover_image_path:               template.cover_image_path || null,
          cover_button_text:              template.cover_button_text || null,
          cover_bg_style:                 template.cover_bg_style || null,
          cover_bg_color_1:               template.cover_bg_color_1 || null,
          cover_bg_color_2:               template.cover_bg_color_2 || null,
          cover_gradient_type:            template.cover_gradient_type || null,
          cover_gradient_angle:           template.cover_gradient_angle ?? null,
          cover_gradient_position_x:      template.cover_gradient_position_x ?? null,
          cover_gradient_position_y:      template.cover_gradient_position_y ?? null,
          cover_gradient_stops:           template.cover_gradient_stops ?? null,
          cover_overlay_opacity:          template.cover_overlay_opacity ?? null,
          cover_text_color:               template.cover_text_color || null,
          cover_subtitle_color:           template.cover_subtitle_color || null,
          cover_button_bg:                template.cover_button_bg || null,
          cover_button_text_color:        template.cover_button_text_color || null,
          cover_show_date:                template.cover_show_date ?? false,
          cover_date:                     template.cover_date || null,
          cover_show_prepared_by:         template.cover_show_prepared_by ?? true,
          cover_show_client_logo:         template.cover_show_client_logo ?? false,
          cover_show_avatar:              template.cover_show_avatar ?? false,
          cover_client_logo_path:         template.cover_client_logo_path || null,
          cover_client_logo_tint_color:   template.cover_client_logo_tint_color ?? null,
          cover_avatar_path:              template.cover_avatar_path || null,
          prepared_by:                    template.prepared_by || null,
          prepared_by_member_id:          template.prepared_by_member_id || null,
          bg_image_path:                  template.bg_image_path || null,
          bg_image_overlay_opacity:       template.bg_image_overlay_opacity ?? null,
          bg_image_blur:                  template.bg_image_blur ?? null,
          page_orientation:               template.page_orientation || 'portrait',
          text_page_bg_color:             template.text_page_bg_color || null,
          text_page_text_color:           template.text_page_text_color || null,
          text_page_heading_color:        template.text_page_heading_color || null,
          text_page_font_size:            template.text_page_font_size || null,
          text_page_border_enabled:       template.text_page_border_enabled ?? null,
          text_page_border_color:         template.text_page_border_color || null,
          text_page_border_radius:        template.text_page_border_radius || null,
          text_page_layout:               template.text_page_layout || null,
          toc_settings:                   template.toc_settings || null,
          title_font_family:              template.title_font_family || null,
          title_font_weight:              template.title_font_weight || null,
          title_font_size:                template.title_font_size || null,
          title_font_transform:           template.title_font_transform || null,
          font_heading_family:            template.font_heading_family || null,
          font_heading_weight:            template.font_heading_weight || null,
          font_heading_size:              template.font_heading_size || null,
          font_heading_transform:         template.font_heading_transform || null,
          font_body_family:               template.font_body_family || null,
          font_body_weight:               template.font_body_weight || null,
          font_body_transform:            template.font_body_transform || null,
          font_button_family:             template.font_button_family ?? null,
          font_button_weight:             template.font_button_weight ?? null,
          page_num_circle_color:          template.page_num_circle_color || null,
          page_num_text_color:            template.page_num_text_color || null,
          post_accept_action:             template.post_accept_action || null,
          post_accept_redirect_url:       template.post_accept_redirect_url || null,
          post_accept_message:            template.post_accept_message || null,
          package_styling:                (template as { package_styling?: unknown }).package_styling ?? null,
          decision_page_enabled:          template.decision_page_enabled ?? null,
          decision_page_title:            template.decision_page_title ?? null,
          decision_extras:                template.decision_extras ?? null,
          decision_action_bg_color:       template.decision_action_bg_color ?? null,
          decision_action_text_color:     template.decision_action_text_color ?? null,
          decision_action_heading_color:  template.decision_action_heading_color ?? null,
          decision_action_accent_color:   template.decision_action_accent_color ?? null,
          decision_decline_button_color:  template.decision_decline_button_color ?? null,
          decision_revision_button_color: template.decision_revision_button_color ?? null,
          decision_checkbox_color:        template.decision_checkbox_color ?? null,
          pricing_header_text_color:      template.pricing_header_text_color ?? null,
          pricing_text_color:             template.pricing_text_color ?? null,
          pricing_price_title_color:      template.pricing_price_title_color ?? null,
          pricing_price_color:            template.pricing_price_color ?? null,
          pricing_payment_schedule_name_color: template.pricing_payment_schedule_name_color ?? null,
          pricing_payment_schedule_price_color: template.pricing_payment_schedule_price_color ?? null,
          pricing_accent_bar_color:       template.pricing_accent_bar_color ?? null,
          pricing_dot_color:              template.pricing_dot_color ?? null,
          page_names:                     template.section_headers || [],
          quote_page_bg_color:            (template as { quote_page_bg_color?: string | null }).quote_page_bg_color ?? null,
          quote_header_bg_color_1:        template.quote_header_bg_color_1 ?? null,
          quote_header_bg_color_2:        template.quote_header_bg_color_2 ?? null,
          quote_header_text_color:        template.quote_header_text_color ?? null,
          quote_header_subtitle_color:    template.quote_header_subtitle_color ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create proposal');
      }
      const { proposal_id } = await res.json();
      await authedFetch('/api/templates/copy-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id, proposal_id }),
      });
      toast.success(template.entity_type === 'quote' ? 'Quote created!' : 'Proposal created!');
      setShowCreateProposal(false);
      const dest = template.entity_type === 'quote' ? `/quotes/${proposal_id}` : `/proposals/${proposal_id}/pages`;
      router.push(dest);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setCreatingProposal(false);
    }
  };

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
      const res = await authedFetch(`/api/templates/${template.id}`, { method: 'DELETE' });
      if (!res.ok) {
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

          <div className="relative" ref={createPopoverRef}>
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={() => {
                setCreateTitle('');
                setCreateClientName('');
                setShowCreateProposal((v) => !v);
              }}
            >
              {template.entity_type === 'quote' ? 'Create Quote' : 'Create Proposal'}
            </Button>
            {showCreateProposal && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-edge shadow-popover p-4 z-50">
                <p className="text-sm font-medium text-ink mb-3">
                  {template.entity_type === 'quote' ? 'New Quote from Template' : 'New Proposal from Template'}
                </p>
                <label className="block text-sm font-medium text-prose mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Website Redesign Proposal"
                  className={`${inputClassName} mb-3`}
                />
                <label className="block text-sm font-medium text-prose mb-1">
                  Client Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createClientName}
                  onChange={(e) => setCreateClientName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProposal(); }}
                  placeholder="e.g. Acme Corp"
                  className={`${inputClassName} mb-3`}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateProposal(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateProposal}
                    loading={creatingProposal}
                    disabled={!createTitle.trim() || !createClientName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </div>
            )}
          </div>

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
