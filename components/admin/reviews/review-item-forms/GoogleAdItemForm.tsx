// components/admin/reviews/review-item-forms/GoogleAdItemForm.tsx
'use client';

import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import GoogleAdMockupPreview from '@/components/admin/reviews/GoogleAdMockupPreview';
import type { GoogleAdFormat } from '@/lib/types/review';
import FormActions from './FormActions';

interface GoogleAdItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  /** Fallback for search ads that don't require a file */
  onSubmitPayload: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
}

export default function GoogleAdItemForm({
  onSubmit,
  onSubmitPayload,
  onBack,
  onCancel,
  uploading,
  onPreviewChange,
}: GoogleAdItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<GoogleAdFormat>('search');
  const [headline, setHeadline] = useState('');
  const [description1, setDescription1] = useState('');
  const [description2, setDescription2] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [finalUrl, setFinalUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Display ad creative
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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

  const isSearch = format === 'search';
  const canSubmit = title.trim() && headline.trim() && !uploading && (isSearch || !!file);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: Record<string, unknown> = {
      title: title.trim(),
      type: 'google_ad',
      google_ad_format: format,
      google_ad_headline: headline.trim() || null,
      google_ad_description1: description1.trim() || null,
      google_ad_description2: description2.trim() || null,
      google_ad_display_url: displayUrl.trim() || null,
      google_ad_final_url: finalUrl.trim() || null,
    };

    if (format === 'display' && file) {
      await onSubmit(payload, file);
    } else {
      await onSubmitPayload(payload);
    }
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
            placeholder="e.g. Brand Keywords – Search Campaign"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            autoFocus
          />
        </div>

        {/* Format toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Ad Format</label>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(['search', 'display'] as GoogleAdFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  format === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'search' ? 'Search Ad' : 'Display Ad'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Headline <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Your ad headline"
            maxLength={90}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">{headline.length}/90</p>
        </div>

        {isSearch && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description Line 1</label>
              <textarea
                value={description1}
                onChange={(e) => setDescription1(e.target.value)}
                rows={2}
                maxLength={90}
                placeholder="First description line…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-y min-h-[56px]"
              />
              <p className="text-[10px] text-gray-400 mt-0.5 text-right">{description1.length}/90</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description Line 2</label>
              <textarea
                value={description2}
                onChange={(e) => setDescription2(e.target.value)}
                rows={2}
                maxLength={90}
                placeholder="Second description line (optional)…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-y min-h-[56px]"
              />
              <p className="text-[10px] text-gray-400 mt-0.5 text-right">{description2.length}/90</p>
            </div>
          </>
        )}

        {!isSearch && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Banner Image <span className="text-red-400">*</span>
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
                <p className="text-xs font-medium text-gray-600">Upload banner creative</p>
                <p className="text-[10px] text-gray-400 mt-0.5">336x280, 300x250, or 728x90 recommended</p>
              </button>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Display URL</label>
          <input
            type="text"
            value={displayUrl}
            onChange={(e) => setDisplayUrl(e.target.value)}
            placeholder="example.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Final URL</label>
          <input
            type="url"
            value={finalUrl}
            onChange={(e) => setFinalUrl(e.target.value)}
            placeholder="https://example.com/landing-page"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!canSubmit}
          uploading={uploading}
          previewToggle={{ visible: showPreview, enabled: !!headline.trim(), onToggle: togglePreview }}
        />
      </div>

      {showPreview && (
        <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <GoogleAdMockupPreview
            format={format}
            headline={headline || 'Your headline here'}
            description1={description1 || 'Your description appears here.'}
            description2={description2}
            displayUrl={displayUrl || 'example.com'}
            creativeUrl={preview || undefined}
            showFormatToggle
            onFormatChange={setFormat}
          />
        </div>
      )}
    </form>
  );
}
