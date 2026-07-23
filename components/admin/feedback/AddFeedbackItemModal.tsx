'use client';

import { useState } from 'react';
import { Image, Globe, Mail, Megaphone, Smartphone, Video, FileText, Search, ClipboardList, RectangleHorizontal, Figma, ChevronRight, ArrowLeft, type LucideIcon } from 'lucide-react';
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
import FigmaItemForm from './feedback-item-forms/FigmaItemForm';

/* ─── Types ────────────────────────────────────────────────────── */

interface AddReviewItemModalProps {
  reviewProjectId: string;
  companyId: string;
  userId: string | null;
  nextSortOrder: number;
  onClose: () => void;
  onSuccess: (created?: CreatedItemSummary) => void;
}

type AssetTypeOption = {
  value: FeedbackItemType;
  label: string;
  icon: LucideIcon;
  description: string;
};

type CategoryKey = 'meta' | 'google' | 'communication' | 'webpage' | 'media' | 'figma';

type Category = {
  key: CategoryKey;
  label: string;
  description: string;
  icon: LucideIcon | null;
  brandLogo?: string;
  brandBg?: string;
  items: AssetTypeOption[];
};

const CATEGORIES: Category[] = [
  {
    key: 'meta',
    label: 'Meta',
    description: 'Facebook & Instagram ads and lead forms',
    icon: null,
    brandLogo: '/icons/brands/facebook.svg',
    brandBg: 'bg-[#1877F2]',
    items: [
      { value: 'ad', label: 'Meta Ad', icon: Megaphone, description: 'Facebook / Instagram ad mockup with copy variants' },
      { value: 'meta_lead_form', label: 'Meta Lead Form', icon: ClipboardList, description: 'Multi-page Meta lead form mockup' },
    ],
  },
  {
    key: 'google',
    label: 'Google Ads',
    description: 'Search and display network campaigns',
    icon: null,
    brandLogo: '/icons/brands/google.svg',
    brandBg: 'bg-[#4285F4]',
    items: [
      { value: 'google_search_ad', label: 'Search Ad', icon: Search, description: 'Headlines, descriptions, sitelinks & call extension' },
      { value: 'google_banner_ad', label: 'Banner Ad', icon: RectangleHorizontal, description: 'Display network banner creative' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    description: 'Email and SMS content',
    icon: Mail,
    items: [
      { value: 'email', label: 'Email', icon: Mail, description: 'Subject line, preheader & body text' },
      { value: 'sms', label: 'SMS', icon: Smartphone, description: 'Text message preview with character count' },
    ],
  },
  {
    key: 'webpage',
    label: 'Web Page',
    description: 'Add a URL and embed a feedback widget',
    icon: Globe,
    items: [
      { value: 'webpage', label: 'Web Page', icon: Globe, description: 'Add a URL and embed a feedback widget' },
    ],
  },
  {
    key: 'figma',
    label: 'Figma Design',
    description: 'Import frames from a Figma file',
    icon: Figma,
    items: [
      { value: 'figma', label: 'Figma Design', icon: Figma, description: 'Import and annotate Figma design frames' },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    description: 'Images, videos, and documents',
    icon: Image,
    items: [
      { value: 'image', label: 'Image', icon: Image, description: 'Upload a design, screenshot, or photo' },
      { value: 'video', label: 'Video', icon: Video, description: 'YouTube, Vimeo, or upload a video file' },
      { value: 'pdf', label: 'PDF', icon: FileText, description: 'Upload a PDF document for review' },
    ],
  },
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
  figma: 'Import Figma Design',
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
  const [step, setStep] = useState<'category' | 'subtype' | 'details'>('category');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
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

  const handleCategorySelect = (cat: Category) => {
    if (cat.items.length === 1) {
      setItemType(cat.items[0].value);
      setSelectedCategory(cat.key);
      setStep('details');
    } else {
      setSelectedCategory(cat.key);
      setStep('subtype');
    }
  };

  const handleSubtypeSelect = (type: FeedbackItemType) => {
    setItemType(type);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'details') {
      const cat = CATEGORIES.find((c) => c.key === selectedCategory);
      if (cat && cat.items.length === 1) {
        setStep('category');
        setSelectedCategory(null);
      } else {
        setStep('subtype');
      }
      setIsWide(false);
    } else if (step === 'subtype') {
      setStep('category');
      setSelectedCategory(null);
    }
  };

  const handlePreviewChange = (visible: boolean) => setIsWide(visible);

  const activeCat = CATEGORIES.find((c) => c.key === selectedCategory);

  const modalTitle = step === 'category'
    ? 'Add Asset'
    : step === 'subtype'
      ? activeCat?.label ?? 'Choose Type'
      : (TITLES[itemType] || 'New Asset');

  // Meta Ad gets the full-width modal for the two-column layout
  const isMetaAd = step === 'details' && itemType === 'ad';
  const modalSize = isMetaAd ? 'full' : (isWide ? 'xl' : 'lg');

  return (
    <Modal
      open
      onClose={onClose}
      title={modalTitle}
      size={modalSize}
    >
        {/* Step 1: Choose category */}
        {step === 'category' && (
          <Modal.Body className="space-y-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleCategorySelect(cat)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors bg-surface hover:bg-teal/5 cursor-pointer group"
              >
                <CategoryIcon category={cat} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{cat.label}</p>
                  <p className="text-xs text-faint">{cat.description}</p>
                </div>
                {cat.items.length > 1 && (
                  <ChevronRight size={16} className="text-faint group-hover:text-teal transition-colors shrink-0" />
                )}
              </button>
            ))}
          </Modal.Body>
        )}

        {/* Step 2: Choose subtype within category */}
        {step === 'subtype' && activeCat && (
          <Modal.Body className="space-y-2">
            <button
              onClick={() => { setStep('category'); setSelectedCategory(null); }}
              className="inline-flex items-center gap-1 text-xs font-medium text-faint hover:text-teal transition-colors mb-1"
            >
              <ArrowLeft size={13} />
              All categories
            </button>
            {activeCat.items.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSubtypeSelect(opt.value)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors bg-surface hover:bg-teal/5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-teal/10">
                    <Icon size={20} className="text-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{opt.label}</p>
                    <p className="text-xs text-faint">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </Modal.Body>
        )}

        {/* Step 3: Type-specific form */}
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
            companyId={companyId}
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
        {step === 'details' && itemType === 'figma' && (
          <FigmaItemForm
            reviewProjectId={reviewProjectId}
            companyId={companyId}
            onBack={handleBack}
            onCancel={onClose}
            onSuccess={onSuccess}
          />
        )}
    </Modal>
  );
}

/* ─── Category icon — brand logo or lucide fallback ───────────── */

function CategoryIcon({ category }: { category: Category }) {
  if (category.brandLogo) {
    return (
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${category.brandBg ?? 'bg-paper0'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={category.brandLogo} alt="" className="w-5 h-5" />
      </div>
    );
  }
  const Icon = category.icon ?? Megaphone;
  return (
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-teal/10">
      <Icon size={20} className="text-teal" />
    </div>
  );
}
