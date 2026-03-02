// components/admin/shared/CoverEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Image, Eye, EyeOff, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CoverColorControls, { CoverColorValues } from '@/components/admin/shared/CoverColorControls';

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
    fields: { subtitle: true, preparedBy: true, acceptButtonText: true },
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
    fields: { subtitle: true, preparedBy: true, acceptButtonText: false },
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
    fields: { subtitle: true, preparedBy: false, acceptButtonText: false },
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
  const [preparedBy, setPreparedBy] = useState(entity.prepared_by || entity.created_by_name || '');
  const [imagePath, setImagePath] = useState(entity.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /* ── Image upload / remove ─────────────────────────────────── */
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
    };

    if (cfg.fields.preparedBy) {
      payload.prepared_by = preparedBy.trim() || null;
    }
    if (cfg.fields.acceptButtonText) {
      payload.accept_button_text = acceptButtonText.trim() || null;
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

          {/* Prepared By */}
          {cfg.fields.preparedBy && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{cfg.labels.preparedByLabel}</label>
              <input
                type="text"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Your name or company"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              />
              {cfg.labels.preparedByHint && (
                <p className="text-xs text-gray-400 mt-1">{cfg.labels.preparedByHint}</p>
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
              <div>
                <img src="/logo-white.svg" alt="Logo" className="h-4 opacity-90" />
              </div>
              <div>
                <h2
                  className="text-lg font-semibold leading-tight mb-1 font-[family-name:var(--font-display)]"
                  style={{ color: colors.coverTextColor }}
                >
                  {displayTitle}
                </h2>
                {previewSubtitle && (
                  <p className="text-xs mb-3" style={{ color: colors.coverSubtitleColor }}>
                    {previewSubtitle}
                    {preparedBy && cfg.fields.preparedBy && (
                      <>
                        <br />
                        <span className="opacity-80">Prepared by {preparedBy}</span>
                      </>
                    )}
                  </p>
                )}
                <div
                  className="inline-block px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-sm"
                  style={{ backgroundColor: colors.coverButtonBg, color: colors.coverButtonTextColor }}
                >
                  {buttonText || cfg.defaultButtonText}
                </div>
              </div>
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