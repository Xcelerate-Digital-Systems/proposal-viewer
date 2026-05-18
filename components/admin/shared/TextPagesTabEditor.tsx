// components/admin/shared/TextPagesTabEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, FileText } from 'lucide-react';
import { useTextPagesEditor } from './useTextPagesEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import TextPagePreview from './TextPagePreview';
import TextPageSettingsBar from './TextPageSettingsBar';
import { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { supabase } from '@/lib/supabase';

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface TextPagesTabEditorProps {
  apiBase: string;
  entityKey: string;
  entityId: string;
  companyId: string | null;
  extraPostFields?: Record<string, unknown>;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function TextPagesTabEditor({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields = {},
}: TextPagesTabEditorProps) {
  const {
    pages, selectedId, setSelectedId,
    form, updateForm, saveStatus,
    adding, loaded, addPage, deletePage,
  } = useTextPagesEditor({ apiBase, entityKey, entityId, extraPostFields });
  useReportSaveStatus(saveStatus);

  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  // Fetch branding (company base + entity-level overrides) so preview matches viewer
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
    load().catch(() => {/* use defaults */});
  }, [companyId, entityId, entityKey]);

  /* ── Loading ───────────────────────────────────────────────────────────── */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col h-full">

      {/* ── Page navigation tabs ───────────────────────────────── */}
      <div className="flex items-end gap-0 mb-4 border-b border-gray-200 overflow-x-auto">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => setSelectedId(page.id)}
            className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              selectedId === page.id
                ? 'text-teal border-b-2 border-teal -mb-px bg-teal/5'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent -mb-px'
            }`}
          >
            <FileText size={13} className="shrink-0 opacity-70" />
            <span className="truncate max-w-[160px]">{page.title || 'Untitled'}</span>
            {!page.enabled && (
              <span className="text-[10px] opacity-40 ml-0.5">(off)</span>
            )}
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

      {/* ── Editor + Preview + Settings ────────────────────────── */}
      {selectedId && form ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Split: editor (left) / preview (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
            <div className="min-w-0 min-h-0 flex flex-col">
              <RichTextEditor
                content={form.content}
                onUpdate={(content) => updateForm({ content })}
                placeholder="Start writing… Use the Fields button in the toolbar to insert dynamic fields."
              />
            </div>
            <div className="min-w-0 min-h-0 flex flex-col">
              <TextPagePreview
                form={form}
                branding={branding}
                entityId={entityId}
                companyId={companyId}
              />
            </div>
          </div>

          {/* Settings underneath */}
          <TextPageSettingsBar
            form={form}
            companyId={companyId}
            onUpdate={updateForm}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText size={28} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 mb-1">No text page selected</p>
            <p className="text-xs text-gray-300">
              Select a page from the list or add a new one
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
