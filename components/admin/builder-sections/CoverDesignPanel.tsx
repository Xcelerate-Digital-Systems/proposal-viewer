// components/admin/builder-sections/CoverDesignPanel.tsx
// Cover-design half of the split CoverEditor. Owns colours + cover background
// image only; the Cover tab keeps the content-only editor. Both panels save
// disjoint slices of the same row so there's no race in practice (different
// tabs are never mounted at the same time).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Palette, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import CoverColorControls, { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { resolveStops } from '@/lib/gradient-stops';
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

  /* ── State ──────────────────────────────────────────────────── */
  const [imagePath, setImagePath] = useState(entity.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [colors, setColors] = useState<CoverColorValues>({
    coverBgStyle: (entity.cover_bg_style as 'gradient' | 'solid') || 'gradient',
    coverGradientType: (entity.cover_gradient_type as 'linear' | 'radial' | 'conic') || 'linear',
    coverGradientAngle: entity.cover_gradient_angle ?? 135,
    coverBgColor1: entity.cover_bg_color_1 || '#0f0f0f',
    coverBgColor2: entity.cover_bg_color_2 || '#141414',
    coverGradientStops: resolveStops(
      (entity as { cover_gradient_stops?: unknown }).cover_gradient_stops,
      entity.cover_bg_color_1 || '#0f0f0f',
      entity.cover_bg_color_2 || '#141414',
    ),
    coverOverlayOpacity: entity.cover_overlay_opacity ?? 0.65,
    coverTextColor: entity.cover_text_color || '#ffffff',
    coverSubtitleColor: entity.cover_subtitle_color || '#ffffffb3',
    coverButtonBg: entity.cover_button_bg || '#01434A',
    coverButtonTextColor: entity.cover_button_text_color || '#ffffff',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
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

  /* ── Save (design fields only) ──────────────────────────────── */
  const save = useCallback(async () => {
    setSaveStatus('saving');
    const payload: Record<string, unknown> = {
      cover_image_path: imagePath || null,
      cover_bg_style: colors.coverBgStyle,
      cover_bg_color_1: colors.coverBgColor1,
      cover_bg_color_2: colors.coverBgColor2,
      cover_gradient_stops: colors.coverGradientStops,
      cover_gradient_type: colors.coverGradientType,
      cover_gradient_angle: colors.coverGradientAngle,
      cover_overlay_opacity: colors.coverOverlayOpacity,
      cover_text_color: colors.coverTextColor,
      cover_subtitle_color: colors.coverSubtitleColor,
      cover_button_bg: colors.coverButtonBg,
      cover_button_text_color: colors.coverButtonTextColor,
    };
    const { error } = await supabase.from(cfg.table).update(payload).eq('id', entity.id);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    if (error) toast.error('Failed to save cover design');
    else onSave?.();
  }, [cfg.table, entity.id, imagePath, colors, onSave, toast]);

  const scheduleSave = useCallback((delay = 800) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
      debounceRef.current = null;
    }, delay);
  }, [save]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePath, colors]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

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
  };

  const updateColors = (partial: Partial<CoverColorValues>) => {
    setColors((prev) => ({ ...prev, ...partial }));
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      <SectionCard
        title="Cover Background Image"
        description="Optional photo behind the cover. Leave empty to use the gradient / solid colour below."
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
            <span className="text-xs font-medium">Upload background image</span>
          </button>
        )}
      </SectionCard>

      <SectionCard
        title="Cover Colours"
        description="Gradient or solid background, title / subtitle / button colours."
        icon={<Palette size={14} className="text-gray-400" />}
      >
        <CoverColorControls {...colors} onChange={updateColors} />
      </SectionCard>
    </div>
  );
}
