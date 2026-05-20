// components/admin/builder-sections/TextPagesSection.tsx
// Text pages tab — mirrors the Quote (Pricing) tab layout: page strip + 65/35
// SplitPanelLayout. Left column stacks an Enabled toggle, the Page Settings card,
// and the rich-text editor. Right column is the live preview (scaled viewer page).
'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import BuilderPageStrip from '@/components/admin/shared/BuilderPageStrip';
import { useTextPagesEditor } from '@/components/admin/shared/useTextPagesEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import Chip from '@/components/ui/Chip';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import TextPagePreview from '@/components/admin/shared/TextPagePreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import TextPageSettingsCard from '@/components/admin/shared/TextPageSettingsCard';
import { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { supabase } from '@/lib/supabase';

interface TextPagesSectionProps {
  apiBase: string;
  entityKey: string;
  entityId: string;
  companyId: string | null;
  extraPostFields?: Record<string, unknown>;
}

export default function TextPagesSection({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields = {},
}: TextPagesSectionProps) {
  const {
    pages, selectedId, setSelectedId,
    form, updateForm, saveStatus,
    adding, loaded, addPage, deletePage,
  } = useTextPagesEditor({ apiBase, entityKey, entityId, extraPostFields });
  useReportSaveStatus(saveStatus);

  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      const r = await fetch(`/api/company/branding?company_id=${companyId}`);
      if (!r.ok) return;
      const merged: CompanyBranding = { ...DEFAULT_BRANDING, ...(await r.json()) };

      // Entity-level design overrides — only proposals/templates carry these columns
      const entityTable =
        entityKey === 'proposal_id' ? 'proposals' :
        entityKey === 'template_id' ? 'templates' :
        null;
      const { data: entity } = entityTable
        ? await supabase
            .from(entityTable)
            .select('text_page_bg_color, text_page_text_color, text_page_heading_color, title_font_family, title_font_weight, title_font_size, bg_image_path, bg_image_overlay_opacity, bg_image_blur')
            .eq('id', entityId)
            .single()
        : { data: null };

      if (entity) {
        if (entity.text_page_bg_color != null) merged.text_page_bg_color = entity.text_page_bg_color;
        if (entity.text_page_text_color != null) merged.text_page_text_color = entity.text_page_text_color;
        if (entity.text_page_heading_color != null) merged.text_page_heading_color = entity.text_page_heading_color;
        if (entity.title_font_family != null) merged.title_font_family = entity.title_font_family;
        if (entity.title_font_weight != null) merged.title_font_weight = entity.title_font_weight;
        if (entity.title_font_size != null) merged.title_font_size = entity.title_font_size;
        if (entity.bg_image_path) {
          const { data: bgUrlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(entity.bg_image_path);
          if (bgUrlData?.publicUrl) merged.bg_image_url = bgUrlData.publicUrl;
          merged.bg_image_overlay_opacity = entity.bg_image_overlay_opacity ?? merged.bg_image_overlay_opacity ?? 0.85;
          merged.bg_image_blur = entity.bg_image_blur ?? 0;
        }
      }

      setBranding(merged);
    };
    load().catch(() => {});
  }, [companyId, entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  /* ── Page strip ───────────────────────────────────────────────── */

  const pageStrip = (
    <BuilderPageStrip
      pages={pages}
      selectedId={selectedId}
      onSelect={(p) => setSelectedId(p.id)}
      onDelete={deletePage}
      onAdd={addPage}
      adding={adding}
      icon={FileText}
      previewVisible={showPreview}
      onTogglePreview={() => setShowPreview(!showPreview)}
    />
  );

  /* ── Empty state ──────────────────────────────────────────────── */

  if (!selectedId || !form) {
    return (
      <div className="flex flex-col gap-5">
        {pageStrip}
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <FileText size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 mb-1">No text page selected</p>
          <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
        </div>
      </div>
    );
  }

  /* ── Main editor + preview ────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-5">
      {pageStrip}

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {/* Show-on-viewer chip (replaces the old slidey Toggle) */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Show this page</p>
              <p className="text-xs text-gray-400 mt-0.5">Toggle visibility in the proposal viewer</p>
            </div>
            <Chip enabled={form.enabled} onClick={() => updateForm({ enabled: !form.enabled })}>
              {form.enabled ? 'Visible' : 'Hidden'}
            </Chip>
          </div>

          {form.enabled ? (
            <div className="space-y-5">
              <TextPageSettingsCard
                form={form}
                companyId={companyId}
                onUpdate={updateForm}
              />

              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Content</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Write the body of this page</p>
                </div>
                <div className="p-4">
                  <RichTextEditor
                    content={form.content}
                    onUpdate={(content) => updateForm({ content })}
                    placeholder="Start writing… Use the Fields button in the toolbar to insert dynamic fields."
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
              <FileText size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400 mb-1">Text page is currently disabled</p>
              <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
            </div>
          )}
        </div>

        {showPreview && (
          <StickyPreviewAside>
            <TextPagePreview
              form={form}
              branding={branding}
              entityId={entityId}
              companyId={companyId}
            />
          </StickyPreviewAside>
        )}
      </div>
    </div>
  );
}
