// components/admin/shared/cover-editor/CoverEditor.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import {
  EntityType,
  CoverEditorEntity,
  ResolvedMember,
  configs,
} from './CoverEditorTypes';
import CoverSettingsPanel from './CoverSettingsPanel';
import CoverPreview from './CoverPreview';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CoverEditorProps {
  type: EntityType;
  entity: CoverEditorEntity;
  onSave?: () => void;
  /** @deprecated No longer used — autosave handles persistence */
  onCancel?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CoverEditor({ type, entity, onSave }: CoverEditorProps) {
  const cfg = configs[type];
  const displayTitle = entity.title || entity.name || 'Untitled';

  /* ── Content state ─────────────────────────────────────────── */
  const [coverEnabled, setCoverEnabled] = useState(entity.cover_enabled);
  const [subtitle, setSubtitle] = useState(entity.cover_subtitle || '');
  const [buttonText, setButtonText] = useState(entity.cover_button_text || cfg.defaultButtonText);
  const [acceptButtonText, setAcceptButtonText] = useState(entity.accept_button_text || '');
  const [imagePath, setImagePath] = useState(entity.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── Autosave state ────────────────────────────────────────── */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  /* ── Company logo state (for preview) ──────────────────────── */
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  /* ── Client logo state ─────────────────────────────────────── */
  const [clientLogoPath, setClientLogoPath] = useState(entity.cover_client_logo_path || '');
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);

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
    coverOverlayOpacity: entity.cover_overlay_opacity ?? 0.65,
    coverTextColor: entity.cover_text_color || '#ffffff',
    coverSubtitleColor: entity.cover_subtitle_color || '#ffffffb3',
    coverButtonBg: entity.cover_button_bg || '#ff6700',
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
        .select('name, logo_path')
        .eq('id', entity.company_id)
        .single();

      if (data) {
        setCompanyName(data.name || '');
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
  }, [entity.company_id]);

  /* ── Load existing cover image ─────────────────────────────── */
  useEffect(() => {
    if (imagePath) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(imagePath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setImageUrl(data.signedUrl);
        });
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
    }
  }, [clientLogoPath]);

  /* ── Resolve selected member for preview ───────────────────── */
  useEffect(() => {
    if (!preparedByMemberId) {
      setResolvedMember(null);
      return;
    }
    const resolve = async () => {
      const { data } = await supabase
        .from('team_members')
        .select('name, avatar_path')
        .eq('id', preparedByMemberId)
        .single();
      if (data) {
        let avatar_url: string | null = null;
        if (data.avatar_path) {
          const { data: urlData } = await supabase.storage
            .from('proposals')
            .createSignedUrl(data.avatar_path, 3600);
          avatar_url = urlData?.signedUrl || null;
        }
        setResolvedMember({ name: data.name, avatar_url });
      }
    };
    resolve();
  }, [preparedByMemberId]);

  /* ── Cleanup debounce on unmount ───────────────────────────── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ══════════════════════════════════════════════════════════════ */
  /*  Save logic                                                    */
  /* ══════════════════════════════════════════════════════════════ */

  const save = useCallback(async () => {
    setSaveStatus('saving');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      cover_enabled: coverEnabled,
      cover_image_path: imagePath || null,
      cover_subtitle: subtitle || null,
      cover_button_text: buttonText || cfg.defaultButtonText,
      cover_bg_style: colors.coverBgStyle,
      cover_bg_color_1: colors.coverBgColor1,
      cover_bg_color_2: colors.coverBgColor2,
      cover_gradient_type: colors.coverGradientType,
      cover_gradient_angle: colors.coverGradientAngle,
      cover_overlay_opacity: colors.coverOverlayOpacity,
      cover_text_color: colors.coverTextColor,
      cover_subtitle_color: colors.coverSubtitleColor,
      cover_button_bg: colors.coverButtonBg,
      cover_button_text_color: colors.coverButtonTextColor,
      cover_date: coverDate.trim() || null,
      cover_show_date: showDate,
    };

    if (cfg.fields.preparedBy) {
      payload.prepared_by_member_id = preparedByMemberId || null;
      payload.cover_show_prepared_by = showPreparedBy;
      payload.cover_show_avatar = showAvatar;
    }
    if (cfg.fields.acceptButtonText) {
      payload.accept_button_text = acceptButtonText.trim() || null;
    }
    if (cfg.fields.clientLogo) {
      payload.cover_client_logo_path = clientLogoPath || null;
      payload.cover_show_client_logo = showClientLogo;
    }

    await supabase.from(cfg.table).update(payload).eq('id', entity.id);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    onSave?.();
  }, [
    cfg, entity.id, coverEnabled, imagePath, subtitle, buttonText,
    acceptButtonText, colors, coverDate, showDate, preparedByMemberId,
    showPreparedBy, showAvatar, clientLogoPath, showClientLogo, onSave,
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
    // Skip the initial render — don't save on mount
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coverEnabled, subtitle, buttonText, acceptButtonText, imagePath,
    colors, coverDate, showDate, preparedByMemberId, showPreparedBy,
    showAvatar, clientLogoPath, showClientLogo,
  ]);

  /* ══════════════════════════════════════════════════════════════ */
  /*  Handlers                                                      */
  /* ══════════════════════════════════════════════════════════════ */

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const filePath = `covers/${cfg.coverPrefix}${entity.id}-${Date.now()}.${file.name.split('.').pop()}`;

    if (imagePath) {
      await supabase.storage.from('proposals').remove([imagePath]);
    }

    const { error } = await supabase.storage.from('proposals').upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    });

    if (!error) {
      setImagePath(filePath);
      const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setImageUrl(data.signedUrl);
    }
    setUploading(false);
  };

  const removeImage = async () => {
    if (imagePath) {
      await supabase.storage.from('proposals').remove([imagePath]);
    }
    setImagePath('');
    setImageUrl(null);
  };

  const handleClientLogoUpload = async (file: File) => {
    setUploadingClientLogo(true);
    const filePath = `covers/client-logo-${cfg.coverPrefix}${entity.id}-${Date.now()}.${file.name.split('.').pop()}`;

    if (clientLogoPath) {
      await supabase.storage.from('proposals').remove([clientLogoPath]);
    }

    const { error } = await supabase.storage.from('proposals').upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    });

    if (!error) {
      setClientLogoPath(filePath);
      setShowClientLogo(true);
      const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setClientLogoUrl(data.signedUrl);
    }
    setUploadingClientLogo(false);
  };

  const removeClientLogo = async () => {
    if (clientLogoPath) {
      await supabase.storage.from('proposals').remove([clientLogoPath]);
    }
    setClientLogoPath('');
    setClientLogoUrl(null);
    setShowClientLogo(false);
  };

  /* ══════════════════════════════════════════════════════════════ */
  /*  Derived values                                                */
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Cover Page Settings</h4>
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        {/* Left: Settings */}
        <CoverSettingsPanel
          type={type}
          cfg={cfg}
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
          uploadingClientLogo={uploadingClientLogo}
          onClientLogoUpload={handleClientLogoUpload}
          onClientLogoRemove={removeClientLogo}
          acceptButtonText={acceptButtonText}
          setAcceptButtonText={setAcceptButtonText}
          imageUrl={imageUrl}
          imagePath={imagePath}
          uploading={uploading}
          onImageUpload={handleImageUpload}
          onImageRemove={removeImage}
          colors={colors}
          onColorsChange={updateColors}
        />

        {/* Right: Live preview */}
        <div className="lg:sticky lg:top-40">
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
            showClientLogo={showClientLogo}
            clientLogoUrl={clientLogoUrl}
            showDate={showDate}
            coverDate={coverDate}
            showPreparedBy={showPreparedBy}
            showAvatar={showAvatar}
            resolvedMember={resolvedMember}
          />
        </div>
      </div>
    </div>
  );
}