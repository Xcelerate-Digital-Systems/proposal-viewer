'use client';

import { useState } from 'react';
import { Image, Globe, Mail, Megaphone, Smartphone, Video, FileText, Search, ClipboardList, RectangleHorizontal, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { type FeedbackItemType } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { useFeedbackItemSubmit, type CreatedItemSummary } from './feedback-item-forms/useFeedbackItemSubmit';
import ImageItemForm from './feedback-item-forms/ImageItemForm';
import AdItemForm from './feedback-item-forms/AdItemForm';
import EmailItemForm from './feedback-item-forms/EmailItemForm';
import SmsItemForm from './feedback-item-forms/SmsItemForm';
import WebpageItemForm from './feedback-item-forms/WebpageItemForm';
import VideoItemForm from './feedback-item-forms/VideoItemForm';
import PdfItemForm from './feedback-item-forms/PdfItemForm';
import GoogleSearchAdItemForm from './feedback-item-forms/GoogleSearchAdItemForm';
import GoogleBannerAdItemForm from './feedback-item-forms/GoogleBannerAdItemForm';
import MetaLeadFormItemForm from './feedback-item-forms/MetaLeadFormItemForm';

/* ─── Types ────────────────────────────────────────────────────── */

interface AddReviewItemModalProps {
  reviewProjectId: string;
  companyId: string;
  userId: string | null;
  nextSortOrder: number;
  onClose: () => void;
  onSuccess: (created?: CreatedItemSummary) => void;
}

const typeOptions: { value: FeedbackItemType; label: string; icon: LucideIcon; description: string; enabled: boolean }[] = [
  { value: 'image', label: 'Image', icon: Image, description: 'Upload a design, screenshot, or photo', enabled: true },
  { value: 'video', label: 'Video', icon: Video, description: 'YouTube, Vimeo, or upload a video file', enabled: true },
  { value: 'ad', label: 'Meta Ad', icon: Megaphone, description: 'Facebook / Instagram ad mockup', enabled: true },
  { value: 'meta_lead_form', label: 'Meta Lead Form', icon: ClipboardList, description: 'Multi-page Meta lead form mockup', enabled: true },
  { value: 'google_search_ad', label: 'Google Search Ad', icon: Search, description: 'Headlines, descriptions, sitelinks & call extension', enabled: true },
  { value: 'google_banner_ad', label: 'Google Banner Ad', icon: RectangleHorizontal, description: 'Display network banner creative', enabled: true },
  { value: 'email', label: 'Email', icon: Mail, description: 'Subject line, preheader & body text', enabled: true },
  { value: 'sms', label: 'SMS', icon: Smartphone, description: 'Text message preview with character count', enabled: true },
  { value: 'pdf', label: 'PDF', icon: FileText, description: 'Upload a PDF document for review', enabled: true },
  { value: 'webpage', label: 'Web Page', icon: Globe, description: 'Add a URL and embed a feedback widget', enabled: true },
];

const TITLES: Partial<Record<FeedbackItemType, string>> = {
  image: 'Upload Image',
  video: 'New Video',
  ad: 'New Meta Ad Mockup',
  meta_lead_form: 'New Meta Lead Form',
  google_search_ad: 'New Google Search Ad',
  google_banner_ad: 'New Google Banner Ad',
  email: 'New Email',
  sms: 'New SMS',
  pdf: 'Upload PDF',
  webpage: 'New Web Page',
};

/* ─── Component ────────────────────────────────────────────────── */

export default function AddFeedbackItemModal({
  reviewProjectId,
  companyId,
  userId,
  nextSortOrder,
  onClose,
  onSuccess,
}: AddReviewItemModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [itemType, setItemType] = useState<FeedbackItemType>('image');
  const [isWide, setIsWide] = useState(false);

  const { uploading, submitPayload, submitWithFile, uploadAsset } = useFeedbackItemSubmit({
    reviewProjectId,
    companyId,
    userId,
    nextSortOrder,
    onSuccess,
    onClose,
  });

  const handleTypeSelect = (type: FeedbackItemType, enabled: boolean) => {
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
    <Modal
      open
      onClose={onClose}
      title={step === 'type' ? 'Add Asset' : (TITLES[itemType] || 'New Asset')}
      size={isWide ? 'xl' : 'lg'}
    >
        {/* Step 1: Choose type */}
        {step === 'type' && (
          <Modal.Body className="space-y-2">
            {typeOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleTypeSelect(opt.value, opt.enabled)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors ${
                    opt.enabled
                      ? 'bg-surface hover:bg-teal/5 cursor-pointer'
                      : 'bg-surface/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      opt.enabled ? 'bg-teal/10' : 'bg-gray-100'
                    }`}
                  >
                    <Icon size={20} className={opt.enabled ? 'text-teal' : 'text-faint'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{opt.label}</p>
                    <p className="text-xs text-faint">
                      {opt.description}
                      {!opt.enabled && ' (coming soon)'}
                    </p>
                  </div>
                </button>
              );
            })}
          </Modal.Body>
        )}

        {/* Step 2: Type-specific form */}
        {step === 'details' && itemType === 'image' && (
          <ImageItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
        )}
        {step === 'details' && itemType === 'ad' && (
          <AdItemForm
            onSubmit={submitWithFile}
            onBack={handleBack}
            onCancel={onClose}
            uploading={uploading}
            onPreviewChange={handlePreviewChange}
            reviewProjectId={reviewProjectId}
          />
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
        {step === 'details' && itemType === 'google_search_ad' && (
          <GoogleSearchAdItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
        )}
        {step === 'details' && itemType === 'google_banner_ad' && (
          <GoogleBannerAdItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
        )}
        {step === 'details' && itemType === 'pdf' && (
          <PdfItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
        )}
        {step === 'details' && itemType === 'meta_lead_form' && (
          <MetaLeadFormItemForm
            onSubmit={submitPayload}
            onUploadAsset={uploadAsset}
            onBack={handleBack}
            onCancel={onClose}
            uploading={uploading}
            onPreviewChange={handlePreviewChange}
          />
        )}
        {step === 'details' && itemType === 'webpage' && (
          <WebpageItemForm
            reviewProjectId={reviewProjectId}
            onSubmit={submitPayload}
            onBack={handleBack}
            onCancel={onClose}
            uploading={uploading}
          />
        )}
    </Modal>
  );
}
