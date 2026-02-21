// components/admin/TemplateCoverEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Image, Eye, EyeOff } from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';

interface TemplateCoverEditorProps {
  template: ProposalTemplate;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Convert a hex color to an rgba string for use in gradients.
 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TemplateCoverEditor({ template, onSave, onCancel }: TemplateCoverEditorProps) {
  const [coverEnabled, setCoverEnabled] = useState(template.cover_enabled ?? true);
  const [subtitle, setSubtitle] = useState(template.cover_subtitle || '');
  const [buttonText, setButtonText] = useState(template.cover_button_text || 'START READING PROPOSAL');
  const [imagePath, setImagePath] = useState(template.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Branding state for preview (fetched from company)
  const [branding, setBranding] = useState({
    cover_bg_style: 'gradient' as 'gradient' | 'solid',
    cover_bg_color_1: '#0f0f0f',
    cover_bg_color_2: '#141414',
    cover_text_color: '#ffffff',
    cover_subtitle_color: '#ffffffb3',
    cover_button_bg: '#ff6700',
    cover_button_text: '#ffffff',
    cover_overlay_opacity: 0.65,
  });

  // Fetch company branding for accurate preview
  useEffect(() => {
    if (template.company_id) {
      fetch(`/api/company/branding?company_id=${template.company_id}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setBranding({
              cover_bg_style: data.cover_bg_style || 'gradient',
              cover_bg_color_1: data.cover_bg_color_1 || '#0f0f0f',
              cover_bg_color_2: data.cover_bg_color_2 || '#141414',
              cover_text_color: data.cover_text_color || '#ffffff',
              cover_subtitle_color: data.cover_subtitle_color || '#ffffffb3',
              cover_button_bg: data.cover_button_bg || '#ff6700',
              cover_button_text: data.cover_button_text || '#ffffff',
              cover_overlay_opacity: data.cover_overlay_opacity ?? 0.65,
            });
          }
        })
        .catch(() => {});
    }
  }, [template.company_id]);

  // Load existing cover image preview
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

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const filePath = `covers/template-${template.id}-${Date.now()}.${file.name.split('.').pop()}`;

    // Remove old image if it exists
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

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('proposal_templates').update({
      cover_enabled: coverEnabled,
      cover_image_path: imagePath || null,
      cover_subtitle: subtitle || null,
      cover_button_text: buttonText || 'START READING PROPOSAL',
    }).eq('id', template.id);
    setSaving(false);
    onSave();
  };

  // Build preview background using branding
  const { cover_bg_style, cover_bg_color_1, cover_bg_color_2, cover_overlay_opacity } = branding;

  const previewBg = imageUrl
    ? undefined
    : cover_bg_style === 'solid'
      ? cover_bg_color_1
      : undefined;

  const previewBgImage = imageUrl
    ? undefined
    : cover_bg_style === 'gradient'
      ? `linear-gradient(135deg, ${cover_bg_color_1}, ${cover_bg_color_2})`
      : undefined;

  const previewOverlay = imageUrl
    ? cover_bg_style === 'solid'
      ? hexToRgba(cover_bg_color_1, cover_overlay_opacity)
      : `linear-gradient(to bottom, ${hexToRgba(cover_bg_color_1, cover_overlay_opacity)}, ${hexToRgba(cover_bg_color_2, Math.min(1, cover_overlay_opacity + 0.1))})`
    : undefined;

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Cover Page Settings</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
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
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${coverEnabled ? 'left-5' : 'left-0.5'}`}
              />
            </button>
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Prepared for [Client Name]"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">This will be the default subtitle when creating proposals from this template. Can be overridden per proposal.</p>
          </div>

          {/* Button text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Button Text</label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="START READING PROPOSAL"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  Replace
                </button>
                <button
                  onClick={removeImage}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#017C87]/40 hover:bg-[#017C87]/5 transition-colors">
                {uploading ? (
                  <span className="text-sm text-gray-400">Uploading...</span>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Image size={20} className="text-gray-300" />
                    <span className="text-sm text-gray-400">Click to upload image</span>
                    <span className="text-xs text-gray-300">JPG, PNG, or WebP</span>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                  }}
                />
              </label>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
              }}
            />
          </div>

          <p className="text-xs text-gray-400">
            Cover colors are managed in <span className="font-medium text-gray-500">Branding → Cover Page Colors</span>.
          </p>
        </div>

        {/* Right: Live preview — uses branding colors */}
        <div
          className="rounded-lg overflow-hidden border border-gray-200 relative"
          style={{ minHeight: 280, backgroundColor: cover_bg_color_1 }}
        >
          {/* Background image or branding bg */}
          {imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: previewBg, backgroundImage: previewBgImage }}
            />
          )}

          {/* Overlay for image */}
          {imageUrl && previewOverlay && (
            <div
              className="absolute inset-0"
              style={{
                background: previewOverlay.startsWith('linear') ? previewOverlay : undefined,
                backgroundColor: !previewOverlay.startsWith('linear') ? previewOverlay : undefined,
              }}
            />
          )}

          {/* Preview content */}
          <div className="relative z-10 flex flex-col justify-between h-full p-5" style={{ minHeight: 280 }}>
            <div>
              <img src="/logo-white.svg" alt="Logo" className="h-4 opacity-90" />
            </div>
            <div>
              <h2
                className="text-lg font-semibold leading-tight mb-1 font-[family-name:var(--font-display)]"
                style={{ color: branding.cover_text_color }}
              >
                {template.name}
              </h2>
              <p className="text-xs mb-3" style={{ color: branding.cover_subtitle_color }}>
                {subtitle || 'Prepared for [Client Name]'}
              </p>
              <div
                className="inline-block px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-sm"
                style={{ backgroundColor: branding.cover_button_bg, color: branding.cover_button_text }}
              >
                {buttonText || 'START READING PROPOSAL'}
              </div>
            </div>
            <div />
          </div>

          {/* Disabled overlay */}
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
  );
}