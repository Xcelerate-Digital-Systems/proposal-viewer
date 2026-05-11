'use client';

import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import GoogleBannerAdMockupPreview from '@/components/admin/feedback/GoogleBannerAdMockupPreview';
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
  const [showPreview, setShowPreview] = useState(true);

  const togglePreview = () => {
    const next = !showPreview;
    setShowPreview(next);
    onPreviewChange?.(next);
  };

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
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
      <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-4 overflow-y-auto`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Item Title <span className="text-red-400">*</span></label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder="e.g. Remarketing banner 336x280"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Headline <span className="text-red-400">*</span></label>
          <input
            type="text" value={headline} onChange={(e) => setHeadline(e.target.value.slice(0, 90))}
            placeholder="Your ad headline"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">{headline.length}/90</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Banner Image <span className="text-red-400">*</span></label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-[200px] object-contain rounded-lg border border-gray-200 bg-gray-50" />
              <button type="button" onClick={clearFile} className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500 transition-colors">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-600">Upload banner creative</p>
              <p className="text-[10px] text-gray-400 mt-0.5">336×280, 300×250, or 728×90 recommended</p>
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Display URL</label>
          <input
            type="text" value={displayUrl} onChange={(e) => setDisplayUrl(e.target.value)} placeholder="example.com"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Final URL</label>
          <input
            type="url" value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} placeholder="https://example.com/landing-page"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!canSubmit}
          uploading={uploading}
          previewToggle={{ visible: showPreview, enabled: !!headline.trim() || !!preview, onToggle: togglePreview }}
        />
      </div>

      {showPreview && (
        <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <GoogleBannerAdMockupPreview headline={headline || 'Your headline'} displayUrl={displayUrl || 'example.com'} creativeUrl={preview || undefined} />
        </div>
      )}
    </form>
  );
}
