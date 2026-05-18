// components/admin/builder-sections/CoverDesignPanel.tsx
// Cover-design half of the split CoverEditor. Owns cover-specific visuals
// only — the Cover tab keeps the content-only editor (logo, subtitle,
// prepared-by, etc.). The fill / gradient picker comes from the shared
// HeaderStyleCard so cover styling looks identical on /proposals,
// /templates and /quotes.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, MousePointer2, Palette, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import HeaderStyleCard from '@/components/admin/quotes/HeaderStyleCard';
import type { CoverEditorEntity, EntityType } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import { configs } from '@/components/admin/shared/cover-editor/CoverEditorTypes';

interface Props {
  type: EntityType;
  entity: CoverEditorEntity;
  onSave?: () => void;
}

export default function CoverDesignPanel({ type, entity, onSave }: Props) {
  const cfg = configs[type];
  const toast = useToast();
  // HeaderStyleCard writes to either `proposals` or `proposal_templates` and
  // already understands the cover_* column family. Documents don't have
  // a cover design surface — they only get the image upload below.
  const headerTable = type === 'template' ? 'proposal_templates' : 'proposals';

  /* ── Image state ────────────────────────────────────────────── */
  const [imagePath, setImagePath] = useState(entity.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── Button-only colours (HeaderStyleCard owns the rest) ────── */
  const [buttonBg, setButtonBg] = useState(entity.cover_button_bg || '#01434A');
  const [buttonTextColor, setButtonTextColor] = useState(entity.cover_button_text_color || '#ffffff');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);

  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Resolve image URL ──────────────────────────────────────── */
  useEffect(() => {
    if (!imagePath) {
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(imagePath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setImageUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [imagePath]);

  /* ── Persist a partial patch on this entity row ─────────────── */
  const persist = useCallback(async (patch: Record<string, unknown>) => {
    setSaveStatus('saving');
    const { error } = await supabase.from(cfg.table).update(patch).eq('id', entity.id);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    if (error) toast.error('Failed to save cover design');
    else onSave?.();
  }, [cfg.table, entity.id, onSave, toast]);

  /* ── Image upload ───────────────────────────────────────────── */
  const handleUpload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Background image must be 8 MB or smaller');
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = safe.split('.').pop() || 'jpg';
      const path = `${cfg.coverPrefix}cover-bg/${entity.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('proposals')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setImagePath(path);
      await persist({ cover_image_path: path });
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = async () => {
    if (imagePath) {
      await supabase.storage.from('proposals').remove([imagePath]).catch(() => {});
    }
    setImagePath('');
    await persist({ cover_image_path: null });
  };

  /* ── Render ─────────────────────────────────────────────────── */
  // HeaderStyleCard requires a typed entity. Since proposals + templates share
  // the same cover_* columns, the cast is safe in practice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerEntity = entity as any;

  return (
    <div className="space-y-5">
      <HeaderStyleCard
        proposal={headerEntity}
        companyId={entity.company_id}
        onSaved={() => onSave?.()}
        variant="cover"
        title="Cover Fill"
        description="Solid colour or gradient that sits behind the cover splash. Drag the preview to position radial / conic gradients."
        table={headerTable}
      />

      <SectionCard
        title="Cover Image Overlay"
        description="Optional photo layered on top of the fill above. The fill's overlay-opacity slider controls how much fill shows through."
        icon={<ImageIcon size={14} className="text-gray-400" />}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />
        {imagePath ? (
          <div className="flex items-start gap-3">
            <div
              className="w-24 h-16 rounded-lg border border-gray-200 bg-cover bg-center shrink-0"
              style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }}
            />
            <div className="space-y-1.5">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Replace
              </button>
              <button
                onClick={removeImage}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            <span className="text-xs font-medium">Upload cover image</span>
          </button>
        )}
      </SectionCard>

      <SectionCard
        title="Cover Button"
        description="Colours for the cover's call-to-action button."
        icon={<MousePointer2 size={14} className="text-gray-400" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorPickerField
            label="Button background"
            value={buttonBg}
            fallback="#01434A"
            onChange={(v) => { setButtonBg(v); persist({ cover_button_bg: v }); }}
          />
          <ColorPickerField
            label="Button text"
            value={buttonTextColor}
            fallback="#ffffff"
            onChange={(v) => { setButtonTextColor(v); persist({ cover_button_text_color: v }); }}
          />
        </div>
      </SectionCard>
    </div>
  );
}
