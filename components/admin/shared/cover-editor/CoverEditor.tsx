// components/admin/shared/cover-editor/CoverEditor.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import { resolveStops } from '@/lib/gradient-stops';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import {
  EntityType,
  CoverEditorEntity,
  ResolvedMember,
  configs,
} from './CoverEditorTypes';
import CoverSettingsPanel from './CoverSettingsPanel';
import CoverPreview from './CoverPreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CoverEditorProps {
  type: EntityType;
  entity: CoverEditorEntity;
  onSave?: () => void;
  /** @deprecated No longer used — autosave handles persistence */
  onCancel?: () => void;
  /** Hide the Cover Colors section (used on the Quote cover tab where colours
   *  live on the Settings tab instead). */
  hideColors?: boolean;
  /** Hide the Cover Enabled toggle (quote covers always show). */
  hideEnableToggle?: boolean;
  /** Render only the settings panel — the caller supplies its own preview
   *  (e.g. the Quote cover tab shows the full live quote alongside). */
  panelOnly?: boolean;
  /** Content-only mode for the Cover tab once design fields have moved to the
   *  Design tab. Hides the Background Image + Cover Colors sections AND
   *  excludes design fields from the autosave payload so the Design tab
   *  remains the single writer for cover_bg_*, cover_text_color,
   *  cover_subtitle_color, cover_button_*, cover_image_path. */
  contentOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CoverEditor({ type, entity, onSave, hideColors, hideEnableToggle, panelOnly, contentOnly }: CoverEditorProps) {
  const effectiveHideColors = hideColors || contentOnly;
  const effectiveHideImage = !!contentOnly;
  const cfg = configs[type];
  const displayTitle = entity.title || entity.name || 'Untitled';

  /* ── Content state ─────────────────────────────────────────── */
  const [coverEnabled, setCoverEnabled] = useState(entity.cover_enabled);
  const [subtitle, setSubtitle] = useState(entity.cover_subtitle || '');
  const [buttonText, setButtonText] = useState(entity.cover_button_text || cfg.defaultButtonText);
  const [imagePath, setImagePath] = useState(entity.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── Autosave state ────────────────────────────────────────── */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  /* ── Company logo + branding state (for preview) ───────────── */
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  // Initialize from entity so the preview shows the correct font immediately
  // (before the company-defaults fetch lands). The useEffect below refines
  // these with company-level fallbacks once loaded.
  const entityFonts = entity as {
    title_font_family?: string | null;
    title_font_weight?: string | null;
    font_heading_family?: string | null;
    font_heading_weight?: string | null;
    font_body_family?: string | null;
    font_body_weight?: string | null;
    font_button_family?: string | null;
    font_button_weight?: string | null;
  };
  const [headingFont, setHeadingFont] = useState<string | null>(
    entityFonts.title_font_family || entityFonts.font_heading_family || null,
  );
  const [headingFontWeight, setHeadingFontWeight] = useState<string | null>(
    entityFonts.title_font_weight || entityFonts.font_heading_weight || null,
  );
  const [bodyFont, setBodyFont] = useState<string | null>(entityFonts.font_body_family || null);
  const [bodyFontWeight, setBodyFontWeight] = useState<string | null>(entityFonts.font_body_weight || null);
  const [buttonFont, setButtonFont] = useState<string | null>(entityFonts.font_button_family || null);
  const [buttonFontWeight, setButtonFontWeight] = useState<string | null>(entityFonts.font_button_weight || null);

  /* ── Client logo state ─────────────────────────────────────── */
  const [clientLogoPath, setClientLogoPath] = useState(entity.cover_client_logo_path || '');
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  // null = render the logo as-is; non-null = recolor it to a flat silhouette in the chosen colour
  const [clientLogoTintColor, setClientLogoTintColor] = useState<string | null>(
    entity.cover_client_logo_tint_color ?? null,
  );

  /* ── Prepared By ───────────────────────────────────────────── */
  const [preparedByMemberId, setPreparedByMemberId] = useState<string | null>(
    entity.prepared_by_member_id || null
  );
  const [resolvedMember, setResolvedMember] = useState<ResolvedMember | null>(null);

  /* ── Date & toggle state ───────────────────────────────────── */
  const [coverDate, setCoverDate] = useState(entity.cover_date || '');
  const [showClientLogo, setShowClientLogo] = useState(entity.cover_show_client_logo ?? false);
  const [showAvatar, setShowAvatar] = useState(entity.cover_show_avatar ?? false);
  const [showDate, setShowDate] = useState(entity.cover_show_date ?? false);
  const [showPreparedBy, setShowPreparedBy] = useState(entity.cover_show_prepared_by ?? true);

  /* ── Color state ───────────────────────────────────────────── */
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

  const updateColors = (partial: Partial<CoverColorValues>) => {
    setColors((prev) => ({ ...prev, ...partial }));
  };

  /* ══════════════════════════════════════════════════════════════ */
  /*  Effects                                                       */
  /* ══════════════════════════════════════════════════════════════ */

  /* ── Load company logo for preview ─────────────────────────── */
  useEffect(() => {
    const fetchCompanyLogo = async () => {
      const { data } = await supabase
        .from('companies')
        .select('name, logo_path, font_heading, font_heading_weight, font_body, font_body_weight, font_button, font_button_weight, title_font_family, accent_color, accept_text_color')
        .eq('id', entity.company_id)
        .single();

      if (data) {
        setCompanyName(data.name || '');
        // Entity-level overrides win; fall back to company defaults.
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
          e.title_font_family || e.font_heading_family || data.title_font_family || data.font_heading || null,
        );
        setHeadingFontWeight(
          e.title_font_weight || e.font_heading_weight || data.font_heading_weight || null,
        );
        setBodyFont(e.font_body_family || data.font_body || null);
        setBodyFontWeight(e.font_body_weight || data.font_body_weight || null);
        setButtonFont(e.font_button_family || data.font_button || null);
        setButtonFontWeight(e.font_button_weight || data.font_button_weight || null);
        // If the entity has no explicit button color, inherit from accent
        if (!entity.cover_button_bg && data.accent_color) {
          setColors((prev) => ({
            ...prev,
            coverButtonBg: prev.coverButtonBg === '#01434A' ? data.accent_color : prev.coverButtonBg,
            coverButtonTextColor: prev.coverButtonTextColor === '#ffffff' && data.accept_text_color
              ? data.accept_text_color
              : prev.coverButtonTextColor,
          }));
        }
        if (data.logo_path) {
          const { data: urlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.logo_path);
          if (urlData?.publicUrl) {
            setCompanyLogoUrl(urlData.publicUrl);
          }
        }
      }
    };
    fetchCompanyLogo();
  }, [entity]);

  /* ── Load existing cover image ─────────────────────────────── */
  useEffect(() => {
    if (imagePath) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(imagePath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setImageUrl(data.signedUrl);
        });
    } else {
      setImageUrl(null);
    }
  }, [imagePath]);

  /* ── Load existing client logo ─────────────────────────────── */
  useEffect(() => {
    if (clientLogoPath) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(clientLogoPath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setClientLogoUrl(data.signedUrl);
        });
    } else {
      setClientLogoUrl(null);
    }
  }, [clientLogoPath]);

  /* ── Resolve prepared-by member ────────────────────────────── */
  useEffect(() => {
    if (!preparedByMemberId) {
      setResolvedMember(null);
      return;
    }
    supabase
      .from('team_members')
      .select('id, name, avatar_path')
      .eq('id', preparedByMemberId)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.avatar_path) {
            supabase.storage
              .from('company-assets')
              .createSignedUrl(data.avatar_path, 3600)
              .then(({ data: urlData }) => {
                setResolvedMember({
                  name: data.name,
                  avatar_url: urlData?.signedUrl || null,
                });
              });
          } else {
            setResolvedMember({ name: data.name, avatar_url: null });
          }
        }
      });
  }, [preparedByMemberId]);

  /* ══════════════════════════════════════════════════════════════ */
  /*  Save                                                          */
  /* ══════════════════════════════════════════════════════════════ */

  const save = useCallback(async () => {
    setSaveStatus('saving');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      cover_enabled: coverEnabled,
      cover_subtitle: subtitle || null,
      cover_button_text: buttonText || cfg.defaultButtonText,
      cover_date: coverDate.trim() || null,
      cover_show_date: showDate,
    };

    // Design fields only when this editor owns design (i.e. not content-only)
    if (!contentOnly) {
      payload.cover_image_path = imagePath || null;
      payload.cover_bg_style = colors.coverBgStyle;
      payload.cover_bg_color_1 = colors.coverBgColor1;
      payload.cover_bg_color_2 = colors.coverBgColor2;
      payload.cover_gradient_stops = colors.coverGradientStops;
      payload.cover_gradient_type = colors.coverGradientType;
      payload.cover_gradient_angle = colors.coverGradientAngle;
      payload.cover_overlay_opacity = colors.coverOverlayOpacity;
      payload.cover_text_color = colors.coverTextColor;
      payload.cover_subtitle_color = colors.coverSubtitleColor;
      payload.cover_button_bg = colors.coverButtonBg;
      payload.cover_button_text_color = colors.coverButtonTextColor;
    }

    if (cfg.fields.preparedBy) {
      payload.prepared_by_member_id = preparedByMemberId || null;
      payload.cover_show_prepared_by = showPreparedBy;
      payload.cover_show_avatar = showAvatar;
    }
    // Client-logo fields are owned by the Design tab now (cover_client_logo_path,
    // cover_show_client_logo, cover_client_logo_tint_color). The Cover tab only
    // reads them to render the preview, so they're intentionally not in this payload.

    await supabase.from(cfg.table).update(payload).eq('id', entity.id);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    onSave?.();
  }, [
    cfg, entity.id, coverEnabled, imagePath, subtitle, buttonText,
    colors, coverDate, showDate, preparedByMemberId,
    showPreparedBy, showAvatar, onSave,
  ]);

  const scheduleSave = useCallback((delay = 800) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
      debounceRef.current = null;
    }, delay);
  }, [save]);

  /* ── Autosave: watch all saveable state ────────────────────── */
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coverEnabled, subtitle, buttonText, imagePath,
    colors, coverDate, showDate, preparedByMemberId, showPreparedBy,
    showAvatar,
  ]);

  /* ══════════════════════════════════════════════════════════════ */
  /*  Handlers                                                      */
  /* ══════════════════════════════════════════════════════════════ */

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `covers/${cfg.coverPrefix}${entity.id}-${Date.now()}.${sanitized.split('.').pop()}`;
    const { error } = await supabase.storage.from('proposals').upload(filePath, file, { upsert: true });
    if (!error) {
      setImagePath(filePath);
      const { data: urlData } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (urlData?.signedUrl) setImageUrl(urlData.signedUrl);
    }
    setUploading(false);
  };

  const removeImage = () => {
    setImagePath('');
    setImageUrl(null);
  };

  const handleClientLogoUpload = async (file: File) => {
    setUploadingClientLogo(true);
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `client-logos/${entity.id}-${Date.now()}.${sanitized.split('.').pop()}`;
    const { error } = await supabase.storage.from('proposals').upload(filePath, file, { upsert: true });
    if (!error) {
      setClientLogoPath(filePath);
      const { data: urlData } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (urlData?.signedUrl) setClientLogoUrl(urlData.signedUrl);
    }
    setUploadingClientLogo(false);
  };

  const removeClientLogo = () => {
    setClientLogoPath('');
    setClientLogoUrl(null);
  };

  /* ══════════════════════════════════════════════════════════════ */
  /*  Derived values for preview                                    */
  /* ══════════════════════════════════════════════════════════════ */

  const previewSubtitle =
    subtitle ||
    (type === 'proposal' && entity.client_name ? `Prepared for ${entity.client_name}` : '') ||
    (type === 'template' ? 'Prepared for [Client Name]' : '') ||
    entity.description ||
    '';

  const subtitlePlaceholder =
    cfg.labels.subtitlePlaceholder ||
    (type === 'proposal' && entity.client_name ? `Prepared for ${entity.client_name}` : 'Cover subtitle');

  /* ══════════════════════════════════════════════════════════════ */
  /*  Render                                                        */
  /* ══════════════════════════════════════════════════════════════ */

  if (panelOnly) {
    return (
      <CoverSettingsPanel
        type={type}
        cfg={cfg}
        hideColors={effectiveHideColors}
        hideEnableToggle={hideEnableToggle}
        hideImage={effectiveHideImage}
        companyId={entity.company_id}
        clientName={entity.client_name}
        coverEnabled={coverEnabled}
        setCoverEnabled={setCoverEnabled}
        subtitle={subtitle}
        setSubtitle={setSubtitle}
        subtitlePlaceholder={subtitlePlaceholder}
        preparedByMemberId={preparedByMemberId}
        setPreparedByMemberId={setPreparedByMemberId}
        showPreparedBy={showPreparedBy}
        setShowPreparedBy={setShowPreparedBy}
        showAvatar={showAvatar}
        setShowAvatar={setShowAvatar}
        coverDate={coverDate}
        setCoverDate={setCoverDate}
        showDate={showDate}
        setShowDate={setShowDate}
        showClientLogo={showClientLogo}
        setShowClientLogo={setShowClientLogo}
        clientLogoUrl={clientLogoUrl}
        clientLogoPath={clientLogoPath}
        clientLogoTintColor={clientLogoTintColor}
        setClientLogoTintColor={setClientLogoTintColor}
        uploadingClientLogo={uploadingClientLogo}
        onClientLogoUpload={handleClientLogoUpload}
        onClientLogoRemove={removeClientLogo}
        acceptButtonText={buttonText}
        setAcceptButtonText={setButtonText}
        imageUrl={imageUrl}
        imagePath={imagePath}
        uploading={uploading}
        onImageUpload={handleImageUpload}
        onImageRemove={removeImage}
        colors={colors}
        onColorsChange={updateColors}
      />
    );
  }

  return (
    // Layout mirrors the Design tab's CoverDesignPanel (and the Quote/Pricing tab):
    // flex-1 left column for inputs, a fixed-width sticky aside on the right for the
    // preview. The aside widths (520/620/700) keep the preview identical between the
    // Cover and Design tabs so they read as the same surface.
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
        <CoverSettingsPanel
          type={type}
          cfg={cfg}
          hideColors={effectiveHideColors}
          hideEnableToggle={hideEnableToggle}
          hideImage={effectiveHideImage}
          companyId={entity.company_id}
          clientName={entity.client_name}
          coverEnabled={coverEnabled}
          setCoverEnabled={setCoverEnabled}
          subtitle={subtitle}
          setSubtitle={setSubtitle}
          subtitlePlaceholder={subtitlePlaceholder}
          preparedByMemberId={preparedByMemberId}
          setPreparedByMemberId={setPreparedByMemberId}
          showPreparedBy={showPreparedBy}
          setShowPreparedBy={setShowPreparedBy}
          showAvatar={showAvatar}
          setShowAvatar={setShowAvatar}
          coverDate={coverDate}
          setCoverDate={setCoverDate}
          showDate={showDate}
          setShowDate={setShowDate}
          showClientLogo={showClientLogo}
          setShowClientLogo={setShowClientLogo}
          clientLogoUrl={clientLogoUrl}
          clientLogoPath={clientLogoPath}
          clientLogoTintColor={clientLogoTintColor}
          setClientLogoTintColor={setClientLogoTintColor}
          uploadingClientLogo={uploadingClientLogo}
          onClientLogoUpload={handleClientLogoUpload}
          onClientLogoRemove={removeClientLogo}
          acceptButtonText={buttonText}
          setAcceptButtonText={setButtonText}
          imageUrl={imageUrl}
          imagePath={imagePath}
          uploading={uploading}
          onImageUpload={handleImageUpload}
          onImageRemove={removeImage}
          colors={colors}
          onColorsChange={updateColors}
        />
      </div>

      <StickyPreviewAside>
        <div className="w-full" style={{ aspectRatio: '4 / 3' }}>
          <CoverPreview
            cfg={cfg}
            coverEnabled={coverEnabled}
            displayTitle={displayTitle}
            buttonText={buttonText}
            previewSubtitle={previewSubtitle}
            colors={colors}
            imageUrl={imageUrl}
            companyLogoUrl={companyLogoUrl}
            companyName={companyName}
            headingFont={headingFont}
            headingFontWeight={headingFontWeight}
            bodyFont={bodyFont}
            bodyFontWeight={bodyFontWeight}
            buttonFont={buttonFont}
            buttonFontWeight={buttonFontWeight}
            showClientLogo={showClientLogo}
            clientLogoUrl={clientLogoUrl}
            clientLogoTintColor={clientLogoTintColor}
            showDate={showDate}
            coverDate={coverDate}
            showPreparedBy={showPreparedBy}
            showAvatar={showAvatar}
            resolvedMember={resolvedMember}
          />
        </div>
      </StickyPreviewAside>
    </div>
  );
}