// components/admin/settings/ProfileEditor.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Trash2, Loader2, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfileEditorProps {
  memberId: string;
  companyId: string;
  name: string;
  avatarPath: string | null;
  onSave: (updates: { name?: string; avatar_path?: string | null }) => Promise<unknown>;
}

export default function ProfileEditor({
  memberId,
  companyId,
  name: initialName,
  avatarPath: initialAvatarPath,
  onSave,
}: ProfileEditorProps) {
  const [name, setName] = useState(initialName);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameChanged = name !== initialName;
  const avatarChanged = avatarPath !== (initialAvatarPath || '');

  /* ── Load existing avatar ──────────────────────────────── */
  useEffect(() => {
    if (avatarPath) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(avatarPath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setAvatarUrl(data.signedUrl);
        });
    } else {
      setAvatarUrl(null);
    }
  }, [avatarPath]);

  /* ── Avatar upload ─────────────────────────────────────── */
  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `avatars/${companyId}/${memberId}-${Date.now()}.${ext}`;

    // Remove old avatar if exists
    if (avatarPath) {
      await supabase.storage.from('proposals').remove([avatarPath]);
    }

    const { error } = await supabase.storage.from('proposals').upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    });

    if (!error) {
      setAvatarPath(filePath);
      const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setAvatarUrl(data.signedUrl);

      // Auto-save avatar path immediately
      await onSave({ avatar_path: filePath });
    }
    setUploading(false);
  };

  /* ── Avatar remove ─────────────────────────────────────── */
  const handleRemoveAvatar = async () => {
    if (avatarPath) {
      await supabase.storage.from('proposals').remove([avatarPath]);
    }
    setAvatarPath('');
    setAvatarUrl(null);
    await onSave({ avatar_path: null });
  };

  /* ── Save name ─────────────────────────────────────────── */
  const handleSaveName = async () => {
    if (!name.trim() || !nameChanged) return;
    setSaving(true);
    await onSave({ name: name.trim() });
    setSaving(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 mb-4">Profile</h2>

      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="shrink-0">
          <div className="relative group">
            {avatarUrl ? (
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="p-1.5 text-white hover:text-gray-200 transition-colors"
                    title="Change photo"
                  >
                    <Camera size={14} />
                  </button>
                  <button
                    onClick={handleRemoveAvatar}
                    className="p-1.5 text-white hover:text-red-300 transition-colors"
                    title="Remove photo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-16 h-16 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-[#017C87]/30 hover:text-[#017C87] transition-colors disabled:opacity-50"
                title="Upload photo"
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <User size={20} />
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1.5 max-w-[64px]">
            {avatarUrl ? 'Hover to edit' : 'Add photo'}
          </p>
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-500 mb-1.5">Display Name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
            />
            {nameChanged && (
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="px-4 py-2 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            This name and photo will appear on proposal cover pages when you&apos;re selected as the author.
          </p>
        </div>
      </div>
    </div>
  );
}1