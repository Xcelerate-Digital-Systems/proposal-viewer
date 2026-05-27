'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

interface Props {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
}

export default function GoogleBannerAdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [headline, setHeadline] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [finalUrl, setFinalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  /* Open the modal at its wide layout — banner upload + headline reads better
     with the wider canvas, even though there's no preview pane. */
  useEffect(() => { onPreviewChange?.(true); }, [onPreviewChange]);

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
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSubmit = !!title.trim() && !!headline.trim() && !!file && !uploading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;

    await onSubmit(
      {
        title: title.trim(),
        type: 'google_banner_ad',
        google_ad_data: {
          final_url: finalUrl.trim(),
          display_url: displayUrl.trim(),
          headlines: [headline.trim()],
          descriptions: [],
          sitelinks: [],
        },
      },
      file,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">Item Title <span className="text-red-400">*</span></label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder="e.g. Remarketing banner 336x280"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">Headline <span className="text-red-400">*</span></label>
          <input
            type="text" value={headline} onChange={(e) => setHeadline(e.target.value.slice(0, 90))}
            placeholder="Your ad headline"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <p className="text-2xs text-faint mt-0.5 text-right">{headline.length}/90</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1.5">Banner Image <span className="text-red-400">*</span></label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-[200px] object-contain rounded-lg border border-edge-strong bg-surface" />
              <button type="button" onClick={clearFile} className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-edge-strong text-dim hover:text-red-500 transition-colors">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-edge-strong rounded-lg p-6 text-center hover:border-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={20} className="mx-auto mb-1.5 text-faint" />
              <p className="text-xs font-medium text-prose">Upload banner creative</p>
              <p className="text-2xs text-faint mt-0.5">336×280, 300×250, or 728×90 recommended</p>
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">Display URL</label>
          <input
            type="text" value={displayUrl} onChange={(e) => setDisplayUrl(e.target.value)} placeholder="example.com"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">Final URL</label>
          <input
            type="url" value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} placeholder="https://example.com/landing-page"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>
      </div>

      <div className="border-t border-edge px-6 py-3">
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
