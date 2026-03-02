// components/admin/shared/CoverEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Image, Eye, EyeOff, Palette, User, Calendar, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CoverColorControls, { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EntityType = 'proposal' | 'template' | 'document';

interface EntityConfig {
  table: string;
  defaultButtonText: string;
  coverPrefix: string;           // for storage path: covers/{prefix}-{id}
  fields: {
    subtitle: boolean;
    preparedBy: boolean;
    acceptButtonText: boolean;
    clientLogo: boolean;
    avatar: boolean;
  };
  labels: {
    subtitle: string;
    subtitleHint: string;
    subtitlePlaceholder: string;
    preparedByLabel: string;
    preparedByHint: string;
  };
}

const configs: Record<EntityType, EntityConfig> = {
  proposal: {
    table: 'proposals',
    defaultButtonText: 'START READING PROPOSAL',
    coverPrefix: '',
    fields: { subtitle: true, preparedBy: true, acceptButtonText: true, clientLogo: true, avatar: true },
    labels: {
      subtitle: 'Subtitle',
      subtitleHint: '',
      subtitlePlaceholder: '',
      preparedByLabel: 'Prepared By',
      preparedByHint: 'Shown on the cover page below the subtitle',
    },
  },
  template: {
    table: 'proposal_templates',
    defaultButtonText: 'START READING PROPOSAL',
    coverPrefix: 'template-',
    fields: { subtitle: true, preparedBy: true, acceptButtonText: false, clientLogo: true, avatar: true },
    labels: {
      subtitle: 'Default Subtitle',
      subtitleHint: 'This will be the default subtitle when creating proposals from this template. Can be overridden per proposal.',
      subtitlePlaceholder: 'Prepared for [Client Name]',
      preparedByLabel: 'Default Prepared By',
      preparedByHint: 'Shown on the cover page. Can be overridden per proposal.',
    },
  },
  document: {
    table: 'documents',
    defaultButtonText: 'START READING',
    coverPrefix: '',
    fields: { subtitle: true, preparedBy: false, acceptButtonText: false, clientLogo: false, avatar: false },
    labels: {
      subtitle: 'Subtitle',
      subtitleHint: 'Displayed below the document title',
      subtitlePlaceholder: 'e.g. Company Capabilities Overview',
      preparedByLabel: '',
      preparedByHint: '',
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Entity interface — union of fields we need from any entity         */
/* ------------------------------------------------------------------ */

export interface CoverEditorEntity {
  id: string;
  company_id: string;
  // Display
  title?: string;
  name?: string;
  client_name?: string;
  description?: string | null;
  created_by_name?: string | null;
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string | null;
  accept_button_text?: string | null;
  prepared_by?: string | null;
  prepared_by_member_id?: string | null;
  cover_bg_style: string | null;
  cover_bg_color_1: string | null;
  cover_bg_color_2: string | null;
  cover_gradient_type: string | null;
  cover_gradient_angle: number | null;
  cover_overlay_opacity: number | null;
  cover_text_color: string | null;
  cover_subtitle_color: string | null;
  cover_button_bg: string | null;
  cover_button_text_color: string | null;
  // Cover enhancement fields
  cover_client_logo_path?: string | null;
  cover_avatar_path?: string | null;
  cover_date?: string | null;
  cover_show_client_logo?: boolean;
  cover_show_avatar?: boolean;
  cover_show_date?: boolean;
  cover_show_prepared_by?: boolean;
}

interface CoverEditorProps {
  type: EntityType;
  entity: CoverEditorEntity;
  onSave: () => void;
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildGradient(
  type: 'linear' | 'radial' | 'conic',
  angle: number,
  c1: string,
  c2: string,
): string {
  switch (type) {
    case 'radial':
      return `radial-gradient(circle, ${c1}, ${c2})`;
    case 'conic':
      return `conic-gradient(from ${angle}deg, ${c1}, ${c2})`;
    default:
      return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  }
}

/* ------------------------------------------------------------------ */
/*  Toggle Row — reusable toggle with icon + label                     */
/* ------------------------------------------------------------------ */

function ToggleRow({
  icon,
  label,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-9 h-[18px] rounded-full transition-colors ${enabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-[1px] w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-[1px]'}`} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CoverEditor({ type, entity, onSave, onCancel }: CoverEditorProps) {
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
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Client logo state ─────────────────────────────────────── */
  const [clientLogoPath, setClientLogoPath] = useState(entity.cover_client_logo_path || '');
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  const clientLogoRef = useRef<HTMLInputElement>(null);

  /* ── Prepared By (member selector) ─────────────────────────── */
  const [preparedByMemberId, setPreparedByMemberId] = useState<string | null>(
    entity.prepared_by_member_id || null
  );
  const [resolvedMember, setResolvedMember] = useState<{
    name: string;
    avatar_url: string | null;
  } | null>(null);

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

  /* ── Image upload / remove (background) ────────────────────── */
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

  /* ── Client logo upload / remove ───────────────────────────── */
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

  /* ── Save ──────────────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      cover_enabled: coverEnabled,
      cover_image_path: imagePath || null,
      cover_subtitle: subtitle || null,
      cover_button_text: buttonText || cfg.defaultButtonText,
      // Color fields
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
      // Date (always saved for all entity types)
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
    setSaving(false);
    onSave();
  };

  /* ── Preview background ────────────────────────────────────── */
  const previewBg = imageUrl
    ? undefined
    : colors.coverBgStyle === 'solid'
      ? colors.coverBgColor1
      : undefined;

  const previewBgImage = imageUrl
    ? undefined
    : colors.coverBgStyle === 'gradient'
      ? buildGradient(colors.coverGradientType, colors.coverGradientAngle, colors.coverBgColor1, colors.coverBgColor2)
      : undefined;

  const overlayEnd = Math.min(1, colors.coverOverlayOpacity + 0.1);
  const previewOverlay = imageUrl
    ? colors.coverBgStyle === 'solid'
      ? hexToRgba(colors.coverBgColor1, colors.coverOverlayOpacity)
      : buildGradient(
          colors.coverGradientType,
          colors.coverGradientAngle,
          hexToRgba(colors.coverBgColor1, colors.coverOverlayOpacity),
          hexToRgba(colors.coverBgColor2, overlayEnd),
        )
    : undefined;

  /* ── Preview subtitle fallback ─────────────────────────────── */
  const previewSubtitle =
    subtitle ||
    (type === 'proposal' && entity.client_name ? `Prepared for ${entity.client_name}` : '') ||
    (type === 'template' ? 'Prepared for [Client Name]' : '') ||
    entity.description ||
    '';

  /* ── Subtitle placeholder ──────────────────────────────────── */
  const subtitlePlaceholder =
    cfg.labels.subtitlePlaceholder ||
    (type === 'proposal' && entity.client_name ? `Prepared for ${entity.client_name}` : 'Cover subtitle');

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="bg-gray-50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Cover Page Settings</h4>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:max-h-[calc(100vh-200px)]">
        {/* Left: Settings (scrollable) */}
        <div className="space-y-4 lg:overflow-y-auto lg:pr-2">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200">
            <div className="flex items-center gap-2">
              {coverEnabled ? <Eye size={16} className="text-[#017C87]" /> : <EyeOff size={16} className="text-gray-400" />}
              <span className="text-sm text-gray-900 font-medium">Cover Page</span>
            </div>
            <button
              onClick={() => setCoverEnabled(!coverEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${coverEnabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${coverEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Subtitle */}
          {cfg.fields.subtitle && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{cfg.labels.subtitle}</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={subtitlePlaceholder}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              />
              {cfg.labels.subtitleHint && (
                <p className="text-xs text-gray-400 mt-1">{cfg.labels.subtitleHint}</p>
              )}
              {type === 'proposal' && entity.client_name && !cfg.labels.subtitleHint && (
                <p className="text-xs text-gray-400 mt-1">Leave blank for &quot;Prepared for {entity.client_name}&quot;</p>
              )}
            </div>
          )}

          {/* ── Prepared By section ─────────────────────────── */}
          {cfg.fields.preparedBy && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <User size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Prepared By</span>
              </div>

              {/* Team member selector */}
              <div>
                <PreparedBySelector
                  companyId={entity.company_id}
                  selectedMemberId={preparedByMemberId}
                  onSelect={(id) => setPreparedByMemberId(id)}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  {type === 'template'
                    ? 'Default author for proposals created from this template.'
                    : 'Select who prepared this proposal. Their name and photo come from their profile.'}
                </p>
              </div>

              {/* Toggles — only show when a member is selected */}
              {preparedByMemberId && (
                <>
                  <ToggleRow
                    icon={<Eye size={14} className="text-gray-400" />}
                    label="Show prepared by"
                    enabled={showPreparedBy}
                    onToggle={() => setShowPreparedBy(!showPreparedBy)}
                  />
                  <ToggleRow
                    icon={<User size={14} className="text-gray-400" />}
                    label="Show avatar"
                    enabled={showAvatar}
                    onToggle={() => setShowAvatar(!showAvatar)}
                  />
                </>
              )}
            </div>
          )}

          {/* ── Date section ─────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Date</span>
            </div>
            <ToggleRow
              icon={<Calendar size={14} className="text-gray-400" />}
              label="Show date"
              enabled={showDate}
              onToggle={() => setShowDate(!showDate)}
            />
            {showDate && (
              <div>
                <input
                  type="text"
                  value={coverDate}
                  onChange={(e) => setCoverDate(e.target.value)}
                  placeholder="e.g. Feb 2026"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Free-text date shown on the cover page</p>
              </div>
            )}
          </div>

          {/* ── Client Logo section ──────────────────────────── */}
          {cfg.fields.clientLogo && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <Building2 size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Client Logo</span>
              </div>
              <ToggleRow
                icon={<Building2 size={14} className="text-gray-400" />}
                label="Show client logo"
                enabled={showClientLogo}
                onToggle={() => setShowClientLogo(!showClientLogo)}
              />
              {showClientLogo && (
                <div>
                  {clientLogoUrl ? (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                      <img src={clientLogoUrl} alt="" className="h-8 max-w-[120px] object-contain" />
                      <span className="text-xs text-gray-500 flex-1 truncate">{clientLogoPath.split('/').pop()}</span>
                      <button onClick={removeClientLogo} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => clientLogoRef.current?.click()}
                      disabled={uploadingClientLogo}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#017C87]/30 hover:text-[#017C87] transition-colors disabled:opacity-50"
                    >
                      <Image size={16} />
                      {uploadingClientLogo ? 'Uploading...' : 'Upload client logo'}
                    </button>
                  )}
                  <input
                    ref={clientLogoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleClientLogoUpload(f);
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Displayed in the bottom-right of the cover page</p>
                </div>
              )}
            </div>
          )}

          {/* Cover button text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Button Text</label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder={cfg.defaultButtonText}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
            />
          </div>

          {/* Accept button text — proposals only */}
          {cfg.fields.acceptButtonText && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approve Button Text</label>
              <input
                type="text"
                value={acceptButtonText}
                onChange={(e) => setAcceptButtonText(e.target.value)}
                placeholder="Approve & Continue"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">Customise the button clients click to approve. Leave blank for default.</p>
            </div>
          )}

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
            {imageUrl ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
                <img src={imageUrl} alt="" className="w-16 h-10 object-cover rounded" />
                <span className="text-sm text-gray-600 flex-1 truncate">{imagePath.split('/').pop()}</span>
                <button onClick={removeImage} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#017C87]/30 hover:text-[#017C87] transition-colors disabled:opacity-50"
              >
                <Image size={16} />
                {uploading ? 'Uploading...' : 'Upload cover image'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
              }}
            />
          </div>

          {/* ── Cover Colors ────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-gray-100">
              <Palette size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Cover Colors</span>
            </div>
            <div className="p-3">
              <CoverColorControls {...colors} onChange={updateColors} />
            </div>
          </div>
        </div>

        {/* Right: Live preview (sticky) */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <div
            className="rounded-lg overflow-hidden border border-gray-200 relative"
            style={{ height: 320, backgroundColor: colors.coverBgColor1 }}
          >
            {imageUrl ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} />
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: previewBg, backgroundImage: previewBgImage }} />
            )}

            {imageUrl && previewOverlay && (
              <div
                className="absolute inset-0"
                style={{
                  background: previewOverlay.includes('-gradient(') ? previewOverlay : undefined,
                  backgroundColor: !previewOverlay.includes('-gradient(') ? previewOverlay : undefined,
                }}
              />
            )}

            <div className="relative z-10 flex flex-col justify-between h-full p-5">
              {/* Top: company logo */}
              <div>
                <img src="/logo-white.svg" alt="Logo" className="h-4 opacity-90" />
              </div>

              {/* Middle: content */}
              <div>
                {/* Client logo (above title) */}
                {showClientLogo && clientLogoUrl && (
                  <img src={clientLogoUrl} alt="" className="h-5 max-w-[100px] object-contain mb-2 opacity-90" />
                )}

                <h2
                  className="text-lg font-semibold leading-tight mb-0.5 font-[family-name:var(--font-display)]"
                  style={{ color: colors.coverTextColor }}
                >
                  {displayTitle}
                </h2>

                {/* Date (under title) */}
                {showDate && coverDate && (
                  <p className="text-[10px] opacity-70 mb-1" style={{ color: colors.coverSubtitleColor }}>
                    {coverDate}
                  </p>
                )}

                {/* Subtitle */}
                {previewSubtitle && (
                  <p className="text-xs mb-1" style={{ color: colors.coverSubtitleColor }}>
                    {previewSubtitle}
                  </p>
                )}

                {/* Prepared-by + avatar (from resolved member) */}
                {cfg.fields.preparedBy && showPreparedBy && resolvedMember && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {showAvatar && resolvedMember.avatar_url && (
                      <img src={resolvedMember.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                    )}
                    <span className="text-[10px] opacity-80" style={{ color: colors.coverSubtitleColor }}>
                      Prepared by {resolvedMember.name}
                    </span>
                  </div>
                )}

                <div
                  className="inline-block px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-sm"
                  style={{ backgroundColor: colors.coverButtonBg, color: colors.coverButtonTextColor }}
                >
                  {buttonText || cfg.defaultButtonText}
                </div>
              </div>

              {/* Bottom spacer */}
              <div />
            </div>

            {!coverEnabled && (
              <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
                <div className="flex items-center gap-2 text-[#666] text-sm">
                  <EyeOff size={16} />
                  Cover page disabled
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}