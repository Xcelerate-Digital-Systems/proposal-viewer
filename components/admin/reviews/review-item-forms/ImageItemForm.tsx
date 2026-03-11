// components/admin/reviews/review-item-forms/ImageItemForm.tsx
'use client';

import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

interface ImageItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
}

export default function ImageItemForm({ onSubmit, onBack, onCancel, uploading }: ImageItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setFile(selected);

    if (!title) {
      const name = selected.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    await onSubmit({ title: title.trim(), type: 'image' }, file);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Homepage Hero Banner"
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Image <span className="text-red-400">*</span>
        </label>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full max-h-[240px] object-contain rounded-lg border border-gray-200 bg-gray-50" />
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
            <p className="text-xs text-gray-400 mt-1.5">
              {file?.name} · {file ? `${(file.size / 1024).toFixed(0)} KB` : ''}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-[#017C87] hover:bg-[#017C87]/5 transition-colors"
          >
            <Upload size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">Click to upload</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP up to 10MB</p>
          </button>
        )}
      </div>

      <FormActions onBack={onBack} onCancel={onCancel} disabled={!file || !title.trim() || uploading} uploading={uploading} />
    </form>
  );
}
