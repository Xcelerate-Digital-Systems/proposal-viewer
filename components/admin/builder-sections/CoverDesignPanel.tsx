// components/admin/builder-sections/CoverDesignPanel.tsx
// Cover-design half of the split CoverEditor. Owns cover-specific visuals
// only — the Cover tab keeps the content-only editor (logo, subtitle,
// prepared-by, etc.). The fill / gradient picker comes from the shared
// HeaderStyleCard so cover styling looks identical on /proposals,
// /templates and /quotes. Renders a live CoverPreview alongside the
// controls — same component the Cover tab uses, so what you see here is
// what the public viewer will render.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload, Paintbrush } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import HeaderStyleCard from '@/components/admin/quotes/HeaderStyleCard';
import CoverPreview from '@/components/admin/shared/cover-editor/CoverPreview';
import { resolveStops } from '@/lib/gradient-stops';
import type { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import type { CoverEditorEntity, EntityType, ResolvedMember } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import { configs } from '@/components/admin/shared/cover-editor/CoverEditorTypes';

interface Props {
  type: EntityType;
  entity: CoverEditorEntity;
  onSave?: () => void;
}

export default function CoverDesignPanel({ type, entity, onSave }: Props) {
  const cfg = configs[type];
  const toast = useToast();
  const headerTable = type === 'template' ? 'proposal_templates' : 'proposals';

  /* ── Image state ────────────────────────────────────────────── */
  const [imagePath, setImagePath] = useState(entity.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── Button-only colours (HeaderStyleCard owns the rest) ────── */
  const [buttonBg, setButtonBg] = useState(entity.cover_button_bg || '#01434A');
  const [buttonTextColor, setButtonTextColor] = useState(entity.cover_button_text_color || '#ffffff');

  /* ── Preview-only state ─────────────────────────────────────── */
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [headingFont, setHeadingFont] = useState<string | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [resolvedMember, setResolvedMember] = useState<ResolvedMember | null>(null);

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

  /* ── Resolve company info + client logo + prepared-by ──────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: company } = await supabase
        .from('companies')
        .select('name, logo_path, font_heading, title_font_family')
        .eq('id', entity.company_id)
        .single();
      if (cancelled) return;
      if (company) {
        setCompanyName(company.name || '');
        setHeadingFont(company.font_heading || company.title_font_family || null);
        if (company.logo_path) {
          const { data: url } = supabase.storage.from('company-assets').getPublicUrl(company.logo_path);
          if (url?.publicUrl) setCompanyLogoUrl(url.publicUrl);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [entity.company_id]);

  useEffect(() => {
    if (!entity.cover_client_logo_path) { setClientLogoUrl(null); return; }
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(entity.cover_client_logo_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setClientLogoUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [entity.cover_client_logo_path]);

  useEffect(() => {
    if (!entity.prepared_by_member_id) { setResolvedMember(null); return; }
    let cancelled = false;
    supabase
      .from('team_members')
      .select('name, avatar_path')
      .eq('id', entity.prepared_by_member_id)
      .single()
      .then(async ({ data }) => {
        if (cancelled || !data) return;
        let avatarUrl: string | null = null;
        if (data.avatar_path) {
          const { data: url } = await supabase.storage.from('company-assets').createSignedUrl(data.avatar_path, 3600);
          avatarUrl = url?.signedUrl ?? null;
        }
        setResolvedMember({ name: data.name, avatar_url: avatarUrl });
      });
    return () => { cancelled = true; };
  }, [entity.prepared_by_member_id]);

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

  /* ── Build colors object for the preview ───────────────────── */
  const previewColors: CoverColorValues = {
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
    coverButtonBg: buttonBg,
    coverButtonTextColor: buttonTextColor,
  };

  const displayTitle = entity.title || entity.name || 'Untitled';
  const previewSubtitle =
    entity.cover_subtitle ||
    (type === 'proposal' && entity.client_name ? `Prepared for ${entity.client_name}` : '') ||
    (type === 'template' ? 'Prepared for [Client Name]' : '') ||
    entity.description ||
    '';

  /* ── Render ─────────────────────────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerEntity = entity as any;

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-5">
        <SectionCard
          title="Cover Design"
          description="Fill, image overlay, and call-to-action colours for the cover splash."
          icon={<Paintbrush size={14} className="text-gray-400" />}
        >
          <div className="space-y-6">
            {/* Fill (gradient/solid picker + cover text colours) */}
            <HeaderStyleCard
              proposal={headerEntity}
              companyId={entity.company_id}
              onSaved={() => onSave?.()}
              variant="cover"
              table={headerTable}
              bare
            />

            {/* Image upload */}
            <div className="pt-6 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Cover Image</p>
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
              <p className="text-[11px] text-gray-400 mt-2">
                The fill&apos;s overlay-opacity slider above controls how much fill shows through.
              </p>
            </div>

            {/* Button */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Call-to-action Button</p>
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
            </div>
          </div>
        </SectionCard>
      </div>

      <aside className="hidden lg:block w-[640px] xl:w-[780px] 2xl:w-[900px] shrink-0">
        <div className="sticky top-6">
          <CoverPreview
            cfg={cfg}
            coverEnabled={entity.cover_enabled}
            displayTitle={displayTitle}
            buttonText={entity.cover_button_text || cfg.defaultButtonText}
            previewSubtitle={previewSubtitle}
            colors={previewColors}
            imageUrl={imageUrl}
            companyLogoUrl={companyLogoUrl}
            companyName={companyName}
            headingFont={headingFont}
            showClientLogo={entity.cover_show_client_logo ?? false}
            clientLogoUrl={clientLogoUrl}
            showDate={entity.cover_show_date ?? false}
            coverDate={entity.cover_date || ''}
            showPreparedBy={entity.cover_show_prepared_by ?? true}
            showAvatar={entity.cover_show_avatar ?? false}
            resolvedMember={resolvedMember}
          />
        </div>
      </aside>
    </div>
  );
}
