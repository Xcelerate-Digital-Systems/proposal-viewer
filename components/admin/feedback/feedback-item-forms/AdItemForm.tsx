'use client';

import { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2, Type, AlignLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import FormActions from './FormActions';
import type { MetaAdVariant } from '@/lib/types/feedback';

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

function newVariant(): MetaAdVariant {
  // Short stable id (8 hex chars) — enough to avoid collisions inside one
  // item without bloating the view string. Uses crypto.randomUUID() under
  // the hood for a cryptographically-random seed.
  return { id: crypto.randomUUID().slice(0, 8), primary_text: '', headline: '' };
}

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange }: AdItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [variants, setVariants] = useState<MetaAdVariant[]>(() => [newVariant()]);
  const [activeVariantId, setActiveVariantId] = useState<string>(() => variants[0].id);
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

  const patchVariant = (id: string, patch: Partial<MetaAdVariant>) =>
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addVariant = () => {
    const v = newVariant();
    setVariants((prev) => [...prev, v]);
    setActiveVariantId(v.id);
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((v) => v.id !== id);
      if (activeVariantId === id) setActiveVariantId(next[0].id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    const cleanVariants = variants
      .map((v) => ({ ...v, primary_text: v.primary_text.trim(), headline: v.headline.trim() }))
      .filter((v) => v.primary_text || v.headline);
    const first = cleanVariants[0] ?? { primary_text: '', headline: '' };
    await onSubmit(
      {
        title: title.trim(),
        type: 'ad',
        // Keep ad_headline / ad_copy in sync with the first variant so any
        // legacy consumer that hasn't been updated keeps working.
        ad_headline: first.headline || null,
        ad_copy: first.primary_text || null,
        ad_cta: adCta.trim() || 'Learn More',
        ad_platform: adPlatform,
        meta_ad_variants: cleanVariants.length > 0 ? cleanVariants : null,
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
            placeholder="e.g. Summer Sale"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 "
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

        {/* Variants */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
              Copy Variants
            </label>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal-hover"
            >
              <Plus size={12} />
              Add variant
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">
            Each variant is a (primary text, headline) pair. Reviewers switch between them in the sidebar — pin comments stay scoped to the active variant.
          </p>
          <ol className="space-y-3">
            {variants.map((v, i) => {
              const active = v.id === activeVariantId;
              return (
                <li
                  key={v.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    active ? 'border-teal/40 bg-teal/5' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveVariantId(v.id)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink"
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-medium ${
                        active ? 'bg-teal text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {i + 1}
                      </span>
                      Variant {i + 1}
                    </button>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(v.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded"
                        title="Remove variant"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    <AlignLeft size={10} /> Primary text
                  </label>
                  <textarea
                    value={v.primary_text}
                    onChange={(e) => patchVariant(v.id, { primary_text: e.target.value })}
                    onFocus={() => setActiveVariantId(v.id)}
                    rows={2}
                    placeholder="Body copy shown above the image…"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 resize-y min-h-[56px]"
                  />
                  <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-2.5 mb-1">
                    <Type size={10} /> Headline
                  </label>
                  <input
                    type="text"
                    value={v.headline}
                    onChange={(e) => patchVariant(v.id, { headline: e.target.value })}
                    onFocus={() => setActiveVariantId(v.id)}
                    placeholder="Short punchy headline…"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
                  />
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Call to Action</label>
          <select
            value={adCta}
            onChange={(e) => setAdCta(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20  bg-white"
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
            ctaText={adCta}
            platform={adPlatform}
            pageName="Your Brand"
            showPlatformToggle
            onPlatformChange={setAdPlatform}
            variants={variants}
            activeVariantId={activeVariantId}
            onVariantChange={setActiveVariantId}
          />
        </div>
      )}
    </form>
  );
}
