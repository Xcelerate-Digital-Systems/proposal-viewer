// components/admin/builder-sections/TextPagesSection.tsx
// Quote-style chrome for the multi-page text editor. The canvas + settings
// sidebar are kept as-is — text pages are fundamentally a 2-pane editor, so
// stacking sections doesn't apply. We drop the redundant outer card wrapper
// and tighten the page strip to match the Pricing / Packages tabs.
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, FileText } from 'lucide-react';
import { useTextPagesEditor } from '@/components/admin/shared/useTextPagesEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import InlineTextPageCanvas from '@/components/admin/shared/InlineTextPageCanvas';
import TextPageSettingsSidebar from '@/components/admin/shared/TextPageSettingsSidebar';
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

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      const r = await fetch(`/api/company/branding?company_id=${companyId}`);
      if (!r.ok) return;
      const merged: CompanyBranding = { ...DEFAULT_BRANDING, ...(await r.json()) };

      const entityTable = entityKey === 'proposal_id' ? 'proposals' : 'templates';
      const { data: entity } = await supabase
        .from(entityTable)
        .select('text_page_bg_color, text_page_text_color, text_page_heading_color, title_font_family, title_font_weight, title_font_size, bg_image_path, bg_image_overlay_opacity, bg_image_blur')
        .eq('id', entityId)
        .single();

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

  const pageStrip = (
    <div className="flex items-end gap-0 border-b border-gray-200 overflow-x-auto">
      {pages.map((page) => (
        <button
          key={page.id}
          onClick={() => setSelectedId(page.id)}
          className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            selectedId === page.id
              ? 'text-teal border-b-2 border-teal -mb-px'
              : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'
          }`}
        >
          <FileText size={13} className="shrink-0 opacity-70" />
          <span className="truncate max-w-[160px]">{page.title || 'Untitled'}</span>
          {!page.enabled && <span className="text-[10px] opacity-40 ml-0.5">(off)</span>}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
          >
            <Trash2 size={11} />
          </span>
        </button>
      ))}
      {pages.length === 0 && (
        <span className="px-4 py-2.5 text-sm text-gray-400">
          No text pages yet — add one to get started
        </span>
      )}
      <button
        onClick={addPage}
        disabled={adding}
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/5 transition-colors disabled:opacity-50 shrink-0 border-b-2 border-transparent -mb-px"
      >
        {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Add Page
      </button>
    </div>
  );

  if (!selectedId || !form) {
    return (
      <div className="space-y-5">
        {pageStrip}
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FileText size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 mb-1">No text page selected</p>
          <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      {pageStrip}

      <div className="flex gap-5 flex-1 min-h-0">
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <InlineTextPageCanvas
            form={form}
            branding={branding}
            onUpdate={(content) => updateForm({ content })}
          />
        </div>

        <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <TextPageSettingsSidebar
            form={form}
            companyId={companyId}
            onUpdate={updateForm}
          />
        </div>
      </div>
    </div>
  );
}
