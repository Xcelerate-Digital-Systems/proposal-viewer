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
import { Image as ImageIcon, Loader2, Trash2, Upload, Paintbrush, Type, MousePointerClick, RotateCcw } from 'lucide-react';
import Chip from '@/components/ui/Chip';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import HeaderStyleCard from '@/components/admin/quotes/HeaderStyleCard';
import CoverPreview from '@/components/admin/shared/cover-editor/CoverPreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import { resolveStops } from '@/lib/gradient-stops';
import type { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import type { CoverEditorEntity, EntityType, ResolvedMember } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import { configs } from '@/components/admin/shared/cover-editor/CoverEditorTypes';

interface Props {
  type: EntityType;
  entity: CoverEditorEntity;
  onSave?: () => void;
  /** Live values from the Design tab's Globals card. When provided these
   *  override the entity-row + company fallback so the cover preview
   *  reflects the user's typing without waiting for the debounced save +
   *  parent refetch. */
  liveTitleFontFamily?: string | null;
  liveTitleFontWeight?: string | null;
  liveFontHeadingFamily?: string | null;
  liveFontHeadingWeight?: string | null;
  liveFontBodyFamily?: string | null;
  liveFontBodyWeight?: string | null;
  liveFontButtonFamily?: string | null;
  liveFontButtonWeight?: string | null;
}

export default function CoverDesignPanel({
  type,
  entity,
  onSave,
  liveTitleFontFamily,
  liveTitleFontWeight,
  liveFontHeadingFamily,
  liveFontHeadingWeight,
  liveFontBodyFamily,
  liveFontBodyWeight,
  liveFontButtonFamily,
  liveFontButtonWeight,
}: Props) {
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

  /* ── Client logo state ─────────────────────────────────────── */
  const [clientLogoPath, setClientLogoPath] = useState(entity.cover_client_logo_path || '');
  const [showClientLogo, setShowClientLogo] = useState(entity.cover_show_client_logo ?? false);
  const [clientLogoTintColor, setClientLogoTintColor] = useState<string | null>(
    entity.cover_client_logo_tint_color ?? null,
  );
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  const clientLogoRef = useRef<HTMLInputElement>(null);

  /* ── Preview-only state ─────────────────────────────────────── */
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  // Resolved font + weight cascade: entity override → company default.
  // The Design tab's Globals card writes these onto the entity row, so the
  // cover preview re-renders with the chosen weight once the save lands.
  const [headingFont, setHeadingFont] = useState<string | null>(null);
  const [headingFontWeight, setHeadingFontWeight] = useState<string | null>(null);
  const [bodyFont, setBodyFont] = useState<string | null>(null);
  const [bodyFontWeight, setBodyFontWeight] = useState<string | null>(null);
  const [buttonFont, setButtonFont] = useState<string | null>(null);
  const [buttonFontWeight, setButtonFontWeight] = useState<string | null>(null);
  /* ── Header text colours (now in their own SectionCard) ─────── */
  const [coverTextColor, setCoverTextColor] = useState<string | null>(
    entity.cover_text_color ?? null,
  );
  const [coverSubtitleColor, setCoverSubtitleColor] = useState<string | null>(
    entity.cover_subtitle_color ?? null,
  );
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
        .select('name, logo_path, font_heading, font_heading_weight, font_body, font_body_weight, font_button, font_button_weight, title_font_family')
        .eq('id', entity.company_id)
        .single();
      if (cancelled) return;
      if (company) {
        setCompanyName(company.name || '');
        // Entity-level overrides (set via the Design tab's Globals card) win;
        // fall back to the company defaults when null.
        const e = entity as {
          font_heading_family?: string | null;
          font_heading_weight?: string | null;
          font_body_family?: string | null;
          font_body_weight?: string | null;
          font_button_family?: string | null;
          font_button_weight?: string | null;
          title_font_family?: string | null;
          title_font_weight?: string | null;
        };
        // Cover title cascade — mirrors CoverPage.tsx: title_font_* first
        // (the "Page Title Font" control in Globals), then font_heading_*.
        setHeadingFont(
          e.title_font_family || e.font_heading_family || company.title_font_family || company.font_heading || null,
        );
        setHeadingFontWeight(
          e.title_font_weight || e.font_heading_weight || company.font_heading_weight || null,
        );
        setBodyFont(e.font_body_family || company.font_body || null);
        setBodyFontWeight(e.font_body_weight || company.font_body_weight || null);
        setButtonFont(e.font_button_family || company.font_button || null);
        setButtonFontWeight(e.font_button_weight || company.font_button_weight || null);
        if (company.logo_path) {
          const { data: url } = supabase.storage.from('company-assets').getPublicUrl(company.logo_path);
          if (url?.publicUrl) setCompanyLogoUrl(url.publicUrl);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [entity]);

  useEffect(() => {
    if (!clientLogoPath) { setClientLogoUrl(null); return; }
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(clientLogoPath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setClientLogoUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [clientLogoPath]);

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

  /* ── Client logo handlers ───────────────────────────────────── */
  const handleClientLogoUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Client logo must be 4 MB or smaller');
      return;
    }
    setUploadingClientLogo(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = safe.split('.').pop() || 'png';
      const path = `${cfg.coverPrefix}client-logo/${entity.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('proposals')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setClientLogoPath(path);
      // Auto-enable display the first time someone uploads — saves a click.
      const nextShow = showClientLogo || true;
      setShowClientLogo(nextShow);
      await persist({ cover_client_logo_path: path, cover_show_client_logo: nextShow });
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setUploadingClientLogo(false);
      if (clientLogoRef.current) clientLogoRef.current.value = '';
    }
  };

  const removeClientLogo = async () => {
    if (clientLogoPath) {
      await supabase.storage.from('proposals').remove([clientLogoPath]).catch(() => {});
    }
    setClientLogoPath('');
    setClientLogoTintColor(null);
    await persist({ cover_client_logo_path: null, cover_client_logo_tint_color: null });
  };

  const toggleShowClientLogo = () => {
    const next = !showClientLogo;
    setShowClientLogo(next);
    persist({ cover_show_client_logo: next });
  };

  // Color-overlay chip: turns the tint on/off without throwing away the chosen
  // colour. Off = null in the DB; On with no prior choice defaults to #ffffff
  // (white-out on a dark cover is by far the most common use case).
  const toggleColorOverlay = () => {
    if (clientLogoTintColor) {
      setClientLogoTintColor(null);
      persist({ cover_client_logo_tint_color: null });
    } else {
      const next = '#ffffff';
      setClientLogoTintColor(next);
      persist({ cover_client_logo_tint_color: next });
    }
  };

  const updateTintColor = (v: string) => {
    setClientLogoTintColor(v);
    persist({ cover_client_logo_tint_color: v });
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
          icon={<Paintbrush size={14} className="text-faint" />}
        >
          <div className="space-y-6">
            {/* Fill (gradient/solid picker + overlay opacity). Header title
                + subtitle colours live in their own SectionCard below for
                the unified layout. */}
            <HeaderStyleCard
              proposal={headerEntity}
              companyId={entity.company_id}
              onSaved={() => onSave?.()}
              variant="cover"
              table={headerTable}
              bare
              hideTextColors
            />

            {/* Image upload */}
            <div className="pt-6 border-t border-edge">
              <p className="text-xs font-medium text-dim uppercase tracking-wider mb-2">Cover Image</p>
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
                    className="w-24 h-16 rounded-lg border border-edge-strong bg-cover bg-center shrink-0"
                    style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }}
                  />
                  <div className="space-y-1.5">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-prose bg-surface border border-edge-strong rounded-lg hover:bg-surface disabled:opacity-50 transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-edge-strong text-faint hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  <span className="text-xs font-medium">Upload cover image</span>
                </button>
              )}
              <p className="text-detail text-faint mt-2">
                The fill&apos;s overlay-opacity slider above controls how much fill shows through.
              </p>
            </div>

            {/* Client logo */}
            {cfg.fields.clientLogo && (
              <div className="pt-4 border-t border-edge space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-dim uppercase tracking-wider">Client Logo</p>
                  <Chip enabled={showClientLogo} onClick={toggleShowClientLogo}>
                    Show on cover
                  </Chip>
                </div>

                <input
                  ref={clientLogoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleClientLogoUpload(f);
                  }}
                />

                {clientLogoUrl ? (
                  <div className="flex items-start gap-3">
                    {/* Live preview of the upload — flips to the silhouette when the
                        Color overlay chip is on so the user sees the rendered result. */}
                    <div className="w-24 h-16 rounded-lg border border-edge-strong bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                      {clientLogoTintColor ? (
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundColor: clientLogoTintColor,
                            WebkitMaskImage: `url("${clientLogoUrl}")`,
                            maskImage: `url("${clientLogoUrl}")`,
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'center',
                            maskPosition: 'center',
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain',
                          }}
                        />
                      ) : (
                        <img src={clientLogoUrl} alt="" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => clientLogoRef.current?.click()}
                        disabled={uploadingClientLogo}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-prose bg-surface border border-edge-strong rounded-lg hover:bg-surface disabled:opacity-50 transition-colors"
                      >
                        {uploadingClientLogo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Replace
                      </button>
                      <button
                        onClick={removeClientLogo}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => clientLogoRef.current?.click()}
                    disabled={uploadingClientLogo}
                    className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-edge-strong text-faint hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
                  >
                    {uploadingClientLogo ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    <span className="text-xs font-medium">Upload client logo</span>
                  </button>
                )}

                {clientLogoUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-detail text-dim">
                        Flatten the logo to a single colour (good for placing on dark covers).
                      </p>
                      <Chip enabled={!!clientLogoTintColor} onClick={toggleColorOverlay}>
                        Color overlay
                      </Chip>
                    </div>
                    {clientLogoTintColor && (
                      <ColorPickerField
                        label="Overlay colour"
                        value={clientLogoTintColor}
                        fallback="#ffffff"
                        onChange={updateTintColor}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </SectionCard>

        {/* Cover Header Text — title + subtitle colours, flat ColorPickerField
            stack to match the Pricing Design / Page Colours layout. */}
        <SectionCard
          title="Cover Header Text"
          description="Title and subtitle colours on the cover splash."
          icon={<Type size={14} className="text-faint" />}
          action={
            <button
              onClick={() => {
                setCoverTextColor(null);
                setCoverSubtitleColor(null);
                persist({ cover_text_color: null, cover_subtitle_color: null });
              }}
              className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          }
        >
          <div className="space-y-4">
            <ColorPickerField
              label="Header Title"
              value={coverTextColor}
              fallback="#ffffff"
              onChange={(v) => { setCoverTextColor(v); persist({ cover_text_color: v }); }}
              onReset={() => { setCoverTextColor(null); persist({ cover_text_color: null }); }}
            />
            <ColorPickerField
              label="Header Subtitle"
              value={coverSubtitleColor}
              fallback="#ffffffb3"
              onChange={(v) => { setCoverSubtitleColor(v); persist({ cover_subtitle_color: v }); }}
              onReset={() => { setCoverSubtitleColor(null); persist({ cover_subtitle_color: null }); }}
            />
          </div>
        </SectionCard>

        {/* Call-to-action Button — bg + text colours in their own card with
            the same flat layout. */}
        <SectionCard
          title="Call-to-action Button"
          description="Background and text colours for the cover button."
          icon={<MousePointerClick size={14} className="text-faint" />}
          action={
            <button
              onClick={() => {
                setButtonBg('#01434A');
                setButtonTextColor('#ffffff');
                persist({ cover_button_bg: '#01434A', cover_button_text_color: '#ffffff' });
              }}
              className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          }
        >
          <div className="space-y-4">
            <ColorPickerField
              label="Button Background"
              value={buttonBg}
              fallback="#01434A"
              onChange={(v) => { setButtonBg(v); persist({ cover_button_bg: v }); }}
            />
            <ColorPickerField
              label="Button Text"
              value={buttonTextColor}
              fallback="#ffffff"
              onChange={(v) => { setButtonTextColor(v); persist({ cover_button_text_color: v }); }}
            />
          </div>
        </SectionCard>
      </div>

      <StickyPreviewAside>
        <div className="w-full" style={{ aspectRatio: '4 / 3' }}>
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
            headingFont={liveTitleFontFamily || liveFontHeadingFamily || headingFont}
            headingFontWeight={liveTitleFontWeight || liveFontHeadingWeight || headingFontWeight}
            bodyFont={liveFontBodyFamily || bodyFont}
            bodyFontWeight={liveFontBodyWeight || bodyFontWeight}
            buttonFont={liveFontButtonFamily || buttonFont}
            buttonFontWeight={liveFontButtonWeight || buttonFontWeight}
            showClientLogo={showClientLogo}
            clientLogoUrl={clientLogoUrl}
            clientLogoTintColor={clientLogoTintColor}
            showDate={entity.cover_show_date ?? false}
            coverDate={entity.cover_date || ''}
            showPreparedBy={entity.cover_show_prepared_by ?? true}
            showAvatar={entity.cover_show_avatar ?? false}
            resolvedMember={resolvedMember}
          />
        </div>
      </StickyPreviewAside>
    </div>
  );
}
