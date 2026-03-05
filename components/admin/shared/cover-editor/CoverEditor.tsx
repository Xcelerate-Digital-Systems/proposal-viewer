// components/admin/shared/cover-editor/CoverEditor.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2, Layout } from 'lucide-react';
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

  /* ── Panel height measurement (same pattern as PackagesTab) ── */
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(520);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPanelHeight(Math.max(400, window.innerHeight - rect.top - 32));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* ── Header ──────────────────────────────────────────── */}
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

      {/* ── Two-column split — fixed height, left scrolls ───── */}
      <div ref={containerRef} className="flex gap-6" style={{ height: panelHeight }}>

        {/* Left: Settings (scrollable) */}
        <div className="flex-1 min-w-0 overflow-y-auto pr-2">
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
        </div>

        {/* Right: Live preview — matches page editor frame style */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
            {/* Header bar */}
            <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Cover Page</span>
              <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
                <Layout size={11} />
                Live Preview
              </span>
            </div>

            {/* Preview area — centred, aspect-ratio constrained */}
            <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center p-4">
              <div className="w-full" style={{ aspectRatio: '4/3' }}>
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

            {/* Footer hint */}
            <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
              <span className="text-[10px] text-gray-400">Updates live as you edit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}