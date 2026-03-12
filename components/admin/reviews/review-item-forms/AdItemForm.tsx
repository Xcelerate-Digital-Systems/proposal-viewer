// components/admin/reviews/review-item-forms/AdItemForm.tsx
'use client';

import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/reviews/AdMockupPreview';
import FormActions from './FormActions';

const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

interface AdItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  /** Notify parent when preview panel visibility changes (for modal width) */
  onPreviewChange?: (visible: boolean) => void;
}

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange }: AdItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [adHeadline, setAdHeadline] = useState('');
  const [adCopy, setAdCopy] = useState('');
  const [adCta, setAdCta] = useState('Learn More');
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('facebook_feed');
  const [showPreview, setShowPreview] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    await onSubmit(
      {
        title: title.trim(),
        type: 'ad',
        ad_headline: adHeadline.trim() || null,
        ad_copy: adCopy.trim() || null,
        ad_cta: adCta.trim() || 'Learn More',
        ad_platform: adPlatform,
      },
      file,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
      <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-4 overflow-y-auto`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Item Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer Sale – Facebook Feed"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Creative Image <span className="text-red-400">*</span>
          </label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-[160px] object-contain rounded-lg border border-gray-200 bg-gray-50" />
              <button
                type="button"
                onClick={clearFile}
                className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500 transition-colors"
              >
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
              <p className="text-xs font-medium text-gray-600">Upload ad creative</p>
              <p className="text-[10px] text-gray-400 mt-0.5">1:1 ratio recommended</p>
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Primary Text</label>
          <textarea
            value={adCopy}
            onChange={(e) => setAdCopy(e.target.value)}
            rows={3}
            placeholder="The main body copy shown above the image…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-y min-h-[72px]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Headline</label>
          <input
            type="text"
            value={adHeadline}
            onChange={(e) => setAdHeadline(e.target.value)}
            placeholder="Short punchy headline…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Call to Action</label>
          <select
            value={adCta}
            onChange={(e) => setAdCta(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal bg-white"
          >
            {CTA_OPTIONS.map((cta) => (
              <option key={cta} value={cta}>{cta}</option>
            ))}
          </select>
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!file || !title.trim() || uploading}
          uploading={uploading}
          previewToggle={{ visible: showPreview, enabled: !!preview, onToggle: togglePreview }}
        />
      </div>

      {showPreview && preview && (
        <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <AdMockupPreview
            creativeUrl={preview}
            headline={adHeadline || 'Your headline here'}
            primaryText={adCopy || 'Your primary text here…'}
            ctaText={adCta}
            platform={adPlatform}
            pageName="Your Brand"
            showPlatformToggle
            onPlatformChange={setAdPlatform}
          />
        </div>
      )}
    </form>
  );
}
