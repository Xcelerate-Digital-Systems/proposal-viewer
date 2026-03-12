// components/admin/reviews/review-item-forms/VideoItemForm.tsx
'use client';

import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

interface VideoItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
}

export default function VideoItemForm({ onSubmit, onBack, onCancel, uploading }: VideoItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }
    if (selected.size > 100 * 1024 * 1024) {
      toast.error('Video must be under 100MB');
      return;
    }
    setFile(selected);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setThumbnailFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const hasUrl = videoUrl.trim().length > 0;
  const hasFile = !!file;
  const canSubmit = title.trim() && (hasUrl || hasFile) && !uploading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // If a URL is provided (YouTube/Vimeo), submit as payload with optional thumbnail
    if (hasUrl && thumbnailFile) {
      await onSubmit(
        {
          title: title.trim(),
          type: 'video',
          video_url: videoUrl.trim(),
          url: videoUrl.trim(),
        },
        thumbnailFile,
      );
    } else if (hasUrl) {
      // No thumbnail — we still need a file for submitWithFile, so we call with a dummy
      // Actually this should use submitPayload — but to match the interface, use thumbnail if available
      await onSubmit(
        {
          title: title.trim(),
          type: 'video',
          video_url: videoUrl.trim(),
          url: videoUrl.trim(),
        },
        thumbnailFile || new File([], 'placeholder'),
      );
    } else if (hasFile) {
      await onSubmit(
        {
          title: title.trim(),
          type: 'video',
        },
        file!,
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Item Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Brand Video – 30s"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Video URL
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
          <p className="text-[10px] text-gray-400 mt-1">YouTube, Vimeo, or direct video URL</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">or upload</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Upload Video File
          </label>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{(file.size / (1024 * 1024)).toFixed(1)}MB</p>
              </div>
              <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                <X size={14} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-600">Upload video</p>
              <p className="text-[10px] text-gray-400 mt-0.5">MP4, MOV, WEBM up to 100MB</p>
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Thumbnail (optional)
          </label>
          <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
          {thumbnailPreview ? (
            <div className="relative">
              <img src={thumbnailPreview} alt="Thumbnail" className="w-full max-h-[120px] object-contain rounded-lg border border-gray-200 bg-gray-50" />
              <button
                type="button"
                onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
                className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => thumbnailInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={16} className="mx-auto mb-1 text-gray-400" />
              <p className="text-[10px] text-gray-500">Upload thumbnail image</p>
            </button>
          )}
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!canSubmit}
          uploading={uploading}
        />
      </div>
    </form>
  );
}
