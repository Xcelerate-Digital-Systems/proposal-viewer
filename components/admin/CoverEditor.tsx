// components/admin/CoverEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Upload, Trash2, Image, Eye, EyeOff } from 'lucide-react';
import { supabase, Proposal } from '@/lib/supabase';

interface CoverEditorProps {
  proposal: Proposal;
  onSave: () => void;
  onCancel: () => void;
}

export default function CoverEditor({ proposal, onSave, onCancel }: CoverEditorProps) {
  const [coverEnabled, setCoverEnabled] = useState(proposal.cover_enabled);
  const [subtitle, setSubtitle] = useState(proposal.cover_subtitle || '');
  const [buttonText, setButtonText] = useState(proposal.cover_button_text || 'START READING PROPOSAL');
  const [imagePath, setImagePath] = useState(proposal.cover_image_path || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const filePath = `covers/${proposal.id}-${Date.now()}.${file.name.split('.').pop()}`;

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
    await supabase.from('proposals').update({
      cover_enabled: coverEnabled,
      cover_image_path: imagePath || null,
      cover_subtitle: subtitle || null,
      cover_button_text: buttonText || 'START READING PROPOSAL',
    }).eq('id', proposal.id);
    setSaving(false);
    onSave();
  };

  return (
    <div className="border-t border-[#2a2a2a] bg-[#151515] p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-white">Cover Page Settings</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              {coverEnabled ? <Eye size={16} className="text-[#ff6700]" /> : <EyeOff size={16} className="text-[#555]" />}
              <span className="text-sm text-white font-medium">Cover Page</span>
            </div>
            <button
              onClick={() => setCoverEnabled(!coverEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${coverEnabled ? 'bg-[#ff6700]' : 'bg-[#333]'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${coverEnabled ? 'left-5' : 'left-0.5'}`}
              />
            </button>
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={`Prepared for ${proposal.client_name}`}
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
            />
            <p className="text-xs text-[#555] mt-1">Leave blank for &quot;Prepared for {proposal.client_name}&quot;</p>
          </div>

          {/* Button text */}
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Button Text</label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="START READING PROPOSAL"
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Background Image</label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-12 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]">
                  <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white transition-colors"
                >
                  Replace
                </button>
                <button
                  onClick={removeImage}
                  className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#2a2a2a] rounded-xl cursor-pointer hover:border-[#ff6700]/40 hover:bg-[#ff6700]/5 transition-colors">
                {uploading ? (
                  <span className="text-sm text-[#666]">Uploading...</span>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Image size={20} className="text-[#444]" />
                    <span className="text-sm text-[#666]">Click to upload image</span>
                    <span className="text-xs text-[#444]">JPG, PNG, or WebP</span>
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
        </div>

        {/* Right: Live preview */}
        <div className="rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a] relative" style={{ minHeight: 280 }}>
          {/* Background */}
          {imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]" />
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

          {/* Preview content */}
          <div className="relative z-10 flex flex-col justify-between h-full p-5" style={{ minHeight: 280 }}>
            <div>
              <img src="/logo-white.svg" alt="Logo" className="h-4 opacity-90" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight mb-1 font-[family-name:var(--font-display)]">
                {proposal.title}
              </h2>
              <p className="text-xs text-white/70 mb-3">
                {subtitle || `Prepared for ${proposal.client_name}`}
              </p>
              <div className="inline-block px-4 py-1.5 bg-white text-[#0f0f0f] text-[10px] font-semibold tracking-wider uppercase rounded-sm">
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