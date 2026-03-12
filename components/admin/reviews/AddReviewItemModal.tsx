// components/admin/reviews/AddReviewItemModal.tsx
'use client';

import { useState } from 'react';
import { X, Image, Globe, Mail, Megaphone, Smartphone, Video, FileText, Search, type LucideIcon } from 'lucide-react';
import { type ReviewItemType } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReviewItemSubmit } from './review-item-forms/useReviewItemSubmit';
import ImageItemForm from './review-item-forms/ImageItemForm';
import AdItemForm from './review-item-forms/AdItemForm';
import EmailItemForm from './review-item-forms/EmailItemForm';
import SmsItemForm from './review-item-forms/SmsItemForm';
import WebpageItemForm from './review-item-forms/WebpageItemForm';
import VideoItemForm from './review-item-forms/VideoItemForm';
import PdfItemForm from './review-item-forms/PdfItemForm';
import GoogleAdItemForm from './review-item-forms/GoogleAdItemForm';

/* ─── Types ────────────────────────────────────────────────────── */

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
  { value: 'video', label: 'Video', icon: Video, description: 'YouTube, Vimeo, or upload a video file', enabled: true },
  { value: 'ad', label: 'Meta Ad', icon: Megaphone, description: 'Facebook / Instagram ad mockup', enabled: true },
  { value: 'google_ad', label: 'Google Ad', icon: Search, description: 'Google Search or Display ad mockup', enabled: true },
  { value: 'email', label: 'Email', icon: Mail, description: 'Subject line, preheader & body text', enabled: true },
  { value: 'sms', label: 'SMS', icon: Smartphone, description: 'Text message preview with character count', enabled: true },
  { value: 'pdf', label: 'PDF', icon: FileText, description: 'Upload a PDF document for review', enabled: true },
  { value: 'webpage', label: 'Web Page', icon: Globe, description: 'Add a URL and embed a feedback widget', enabled: true },
];

const TITLES: Partial<Record<ReviewItemType, string>> = {
  image: 'Upload Image',
  video: 'New Video',
  ad: 'New Meta Ad Mockup',
  google_ad: 'New Google Ad',
  email: 'New Email Review',
  sms: 'New SMS Review',
  pdf: 'Upload PDF',
  webpage: 'New Web Page',
};

/* ─── Component ────────────────────────────────────────────────── */

export default function AddReviewItemModal({
  reviewProjectId,
  companyId,
  userId,
  nextSortOrder,
  onClose,
  onSuccess,
}: AddReviewItemModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [itemType, setItemType] = useState<ReviewItemType>('image');
  const [isWide, setIsWide] = useState(false);

  const { uploading, submitPayload, submitWithFile } = useReviewItemSubmit({
    reviewProjectId,
    companyId,
    userId,
    nextSortOrder,
    onSuccess,
    onClose,
  });

  const handleTypeSelect = (type: ReviewItemType, enabled: boolean) => {
    if (!enabled) {
      toast.info('Coming soon');
      return;
    }
    setItemType(type);
    setStep('details');
  };

  const handleBack = () => {
    setStep('type');
    setIsWide(false);
  };

  const handlePreviewChange = (visible: boolean) => setIsWide(visible);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className={`relative bg-white rounded-xl shadow-2xl mx-4 ${
          isWide ? 'w-full max-w-4xl' : 'w-full max-w-lg'
        } max-h-[90vh] flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-display)]">
            {step === 'type' ? 'Add Item' : (TITLES[itemType] || 'New Item')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
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
                      ? 'border-gray-200 hover:border-teal hover:bg-teal/5 cursor-pointer'
                      : 'border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      opt.enabled ? 'bg-teal/10' : 'bg-gray-100'
                    }`}
                  >
                    <Icon size={20} className={opt.enabled ? 'text-teal' : 'text-gray-400'} />
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

        {/* Step 2: Type-specific form */}
        {step === 'details' && itemType === 'image' && (
          <ImageItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
        )}
        {step === 'details' && itemType === 'ad' && (
          <AdItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
        )}
        {step === 'details' && itemType === 'email' && (
          <EmailItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
        )}
        {step === 'details' && itemType === 'sms' && (
          <SmsItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
        )}
        {step === 'details' && itemType === 'video' && (
          <VideoItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
        )}
        {step === 'details' && itemType === 'google_ad' && (
          <GoogleAdItemForm onSubmit={submitWithFile} onSubmitPayload={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
        )}
        {step === 'details' && itemType === 'pdf' && (
          <PdfItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
        )}
        {step === 'details' && itemType === 'webpage' && (
          <WebpageItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} />
        )}
      </div>
    </div>
  );
}
