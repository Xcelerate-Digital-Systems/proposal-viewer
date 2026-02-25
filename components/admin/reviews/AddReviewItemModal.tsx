// components/admin/reviews/AddReviewItemModal.tsx
'use client';

import { useState, useRef } from 'react';
import { X, Upload, Image, Globe, Mail, Megaphone, ChevronLeft, type LucideIcon } from 'lucide-react';
import { supabase, type ReviewItemType } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/reviews/AdMockupPreview';

interface AddReviewItemModalProps {
  reviewProjectId: string;
  companyId: string;
  userId: string | null;
  nextSortOrder: number;
  onClose: () => void;
  onSuccess: (newItemId?: string) => void;
}

const typeOptions: { value: ReviewItemType; label: string; icon: LucideIcon; description: string; enabled: boolean }[] = [
  { value: 'image', label: 'Image', icon: Image, description: 'Upload a design, screenshot, or photo', enabled: true },
  { value: 'ad', label: 'Ad Creative', icon: Megaphone, description: 'Facebook / Instagram ad mockup', enabled: true },
  { value: 'webpage', label: 'Web Page', icon: Globe, description: 'Add a URL and embed a feedback widget', enabled: true },
  { value: 'email', label: 'Email', icon: Mail, description: 'Paste email HTML', enabled: false },
];

const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

export default function AddReviewItemModal({
  reviewProjectId,
  companyId,
  userId,
  nextSortOrder,
  onClose,
  onSuccess,
}: AddReviewItemModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'type' | 'details'>('type');
  const [itemType, setItemType] = useState<ReviewItemType>('image');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Ad-specific fields
  const [adHeadline, setAdHeadline] = useState('');
  const [adCopy, setAdCopy] = useState('');
  const [adCta, setAdCta] = useState('Learn More');
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('facebook_feed');
  const [showPreview, setShowPreview] = useState(false);

  // Webpage-specific fields
  const [webpageUrl, setWebpageUrl] = useState('');

  const handleTypeSelect = (type: ReviewItemType, enabled: boolean) => {
    if (!enabled) {
      toast.info('Coming soon');
      return;
    }
    setItemType(type);
    setStep('details');
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

    if (!title && itemType === 'image') {
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

    // Webpage type: no file needed
    if (itemType === 'webpage') {
      if (!title.trim() || !webpageUrl.trim()) return;
      setUploading(true);
      try {
        const { data: newItem, error: insertError } = await supabase.from('review_items').insert({
          review_project_id: reviewProjectId,
          company_id: companyId,
          title: title.trim(),
          type: 'webpage',
          url: webpageUrl.trim(),
          sort_order: nextSortOrder,
          status: 'in_review',
          created_by: userId,
        }).select('id').single();

        if (insertError || !newItem) {
          toast.error('Failed to create item');
          setUploading(false);
          return;
        }

        toast.success('Web page added');
        onSuccess(newItem.id);
        onClose();
      } catch {
        toast.error('Something went wrong');
        setUploading(false);
      }
      return;
    }

    // Image / Ad types: require file
    if (!file || !title.trim()) return;

    setUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `reviews/${companyId}/${reviewProjectId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        toast.error('Failed to upload image');
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path);

      const imageUrl = urlData.publicUrl;

      const payload: Record<string, unknown> = {
        review_project_id: reviewProjectId,
        company_id: companyId,
        title: title.trim(),
        type: itemType,
        sort_order: nextSortOrder,
        status: 'in_review',
        created_by: userId,
        image_url: imageUrl,
      };

      if (itemType === 'ad') {
        payload.ad_creative_url = imageUrl;
        payload.ad_headline = adHeadline.trim() || null;
        payload.ad_copy = adCopy.trim() || null;
        payload.ad_cta = adCta.trim() || 'Learn More';
        payload.ad_platform = adPlatform;
      }

      const { error: insertError } = await supabase
        .from('review_items')
        .insert(payload);

      if (insertError) {
        toast.error('Failed to create item');
        await supabase.storage.from('company-assets').remove([path]);
        setUploading(false);
        return;
      }

      toast.success('Item added');
      onSuccess();
      onClose();
    } catch {
      toast.error('Something went wrong');
      setUploading(false);
    }
  };

  const resetToTypeSelection = () => {
    setStep('type');
    setFile(null);
    setPreview(null);
    setTitle('');
    setAdHeadline('');
    setAdCopy('');
    setAdCta('Learn More');
    setAdPlatform('facebook_feed');
    setShowPreview(false);
    setWebpageUrl('');
  };

  const isValid = itemType === 'webpage'
    ? !!title.trim() && !!webpageUrl.trim()
    : !!file && !!title.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className={`relative bg-white rounded-xl shadow-2xl mx-4 ${
        step === 'details' && itemType === 'ad' && showPreview ? 'w-full max-w-4xl' : 'w-full max-w-lg'
      } max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-display)]">
            {step === 'type' ? 'Add Item' : itemType === 'ad' ? 'New Ad Mockup' : 'Upload Image'}
          </h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Choose type */}
        {step === 'type' && (
          <div className="p-6 space-y-2 overflow-y-auto">
            {typeOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleTypeSelect(opt.value, opt.enabled)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-colors ${
                    opt.enabled
                      ? 'border-gray-200 hover:border-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
                      : 'border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    opt.enabled ? 'bg-[#017C87]/10' : 'bg-gray-100'
                  }`}>
                    <Icon size={20} className={opt.enabled ? 'text-[#017C87]' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400">
                      {opt.description}
                      {!opt.enabled && ' (coming soon)'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Image details */}
        {step === 'details' && itemType === 'image' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
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
                  <button type="button" onClick={clearFile}
                    className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                  <p className="text-xs text-gray-400 mt-1.5">{file?.name} · {file ? `${(file.size / 1024).toFixed(0)} KB` : ''}</p>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-[#017C87] hover:bg-[#017C87]/5 transition-colors">
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-600">Click to upload</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP up to 10MB</p>
                </button>
              )}
            </div>

            <FormActions onBack={resetToTypeSelection} onCancel={onClose} disabled={!isValid || uploading} uploading={uploading} />
          </form>
        )}

        {/* Step 2: Ad details */}
        {step === 'details' && itemType === 'ad' && (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
            {/* Form side */}
            <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-4 overflow-y-auto`}>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Item Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Sale – Facebook Feed"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
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
                    <button type="button" onClick={clearFile}
                      className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-[#017C87] hover:bg-[#017C87]/5 transition-colors">
                    <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
                    <p className="text-xs font-medium text-gray-600">Upload ad creative</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">1:1 ratio recommended</p>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Primary Text</label>
                <textarea value={adCopy} onChange={(e) => setAdCopy(e.target.value)} rows={3}
                  placeholder="The main body copy shown above the image…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-y min-h-[72px]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Headline</label>
                <input type="text" value={adHeadline} onChange={(e) => setAdHeadline(e.target.value)}
                  placeholder="Short punchy headline…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Call to Action</label>
                <select value={adCta} onChange={(e) => setAdCta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] bg-white">
                  {CTA_OPTIONS.map((cta) => (
                    <option key={cta} value={cta}>{cta}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={resetToTypeSelection}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    <ChevronLeft size={14} /> Change type
                  </button>
                  {preview && (
                    <button type="button" onClick={() => setShowPreview(!showPreview)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                        showPreview
                          ? 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]'
                          : 'text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}>
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={!isValid || uploading}
                    className="px-5 py-2.5 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {uploading ? 'Uploading…' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview side */}
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
        )}

        {/* Step 2: Webpage details */}
        {step === 'details' && itemType === 'webpage' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Staging Site Homepage"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url" value={webpageUrl} onChange={(e) => setWebpageUrl(e.target.value)}
                placeholder="https://staging.example.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                The page where you&apos;ll embed the feedback widget
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#017C87]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe size={16} className="text-[#017C87]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">How it works</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    After adding this item, you&apos;ll get a script tag to paste into your page&apos;s {`<head>`}. 
                    This adds a feedback widget so your client can pin comments directly on the live page.
                  </p>
                </div>
              </div>
            </div>

            <FormActions onBack={resetToTypeSelection} onCancel={onClose} disabled={!isValid || uploading} uploading={uploading} />
          </form>
        )}

      </div>
    </div>
  );
}

function FormActions({
  onBack, onCancel, disabled, uploading,
}: {
  onBack: () => void; onCancel: () => void; disabled: boolean; uploading: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ChevronLeft size={14} /> Change type
      </button>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={disabled}
          className="px-5 py-2.5 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {uploading ? 'Uploading…' : 'Add Item'}
        </button>
      </div>
    </div>
  );
}