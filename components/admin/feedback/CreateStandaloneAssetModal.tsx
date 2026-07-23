'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Image, Globe, Mail, Megaphone, Smartphone, Video, FileText,
  Search, ClipboardList, RectangleHorizontal,
  ChevronRight, ArrowLeft, type LucideIcon,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { supabase, type FeedbackItemType } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { useEntitlements } from '@/hooks/useEntitlements';
import { authFetch } from '@/lib/auth-fetch';
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

interface CreateStandaloneAssetModalProps {
  companyId: string;
  userId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

type AssetTypeOption = {
  value: FeedbackItemType;
  label: string;
  icon: LucideIcon;
  description: string;
};

type CategoryKey = 'meta' | 'google' | 'communication' | 'webpage' | 'media';

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
};

function CategoryIcon({ category }: { category: Category }) {
  if (category.brandLogo) {
    return (
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${category.brandBg || 'bg-surface'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={category.brandLogo} alt="" className="w-5 h-5 brightness-0 invert" />
      </div>
    );
  }
  const Icon = category.icon;
  return (
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-teal/10">
      {Icon && <Icon size={20} className="text-teal" />}
    </div>
  );
}

export default function CreateStandaloneAssetModal({
  companyId,
  userId,
  onClose,
  onSuccess,
}: CreateStandaloneAssetModalProps) {
  const toast = useToast();
  const router = useRouter();
  const { check } = useEntitlements(companyId);
  const reviewCheck = check('reviews');

  const [step, setStep] = useState<'category' | 'subtype' | 'details'>('category');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [itemType, setItemType] = useState<FeedbackItemType>('image');
  const [isWide, setIsWide] = useState(false);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);

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

  const createProjectAndItem = useCallback(
    async (itemPayload: Record<string, unknown>, file?: File) => {
      if (!reviewCheck.allowed) {
        toast.error(reviewCheck.message || 'Plan limit reached');
        return;
      }

      setUploading(true);

      try {
        const assetTitle = title.trim() || (TITLES[itemType] ?? 'Untitled Asset');

        const res = await authFetch(`/api/campaigns?company_id=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: assetTitle,
            project_type: 'asset',
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.id) {
          toast.error(json?.error || 'Failed to create asset');
          setUploading(false);
          return;
        }

        const projectId = json.id as string;
        let imageUrl: string | undefined;

        if (file) {
          const ext = file.name.split('.').pop() || 'png';
          const path = `reviews/${companyId}/${projectId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('company-assets')
            .upload(path, file, { contentType: file.type });

          if (uploadError) {
            toast.error('Failed to upload file');
            setUploading(false);
            return;
          }

          const { data: urlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }

        const fullPayload: Record<string, unknown> = {
          review_project_id: projectId,
          company_id: companyId,
          sort_order: 0,
          status: 'internal_review',
          created_by: userId,
          ...itemPayload,
        };

        if (imageUrl) {
          fullPayload.image_url = imageUrl;
          if (itemPayload.type === 'ad') fullPayload.ad_creative_url = imageUrl;
          else if (itemPayload.type === 'google_banner_ad') {
            const existing = (itemPayload.google_ad_data as Record<string, unknown> | undefined) || {};
            fullPayload.google_ad_data = { ...existing, banner_image_url: imageUrl };
            fullPayload.ad_creative_url = imageUrl;
          } else if (itemPayload.type === 'video') fullPayload.video_url = imageUrl;
          else if (itemPayload.type === 'pdf') fullPayload.pdf_url = imageUrl;
        }

        const adVariationData = fullPayload._ad_variation_data as {
          existing_variation_ids: string[];
          new_variations: { label?: string | null; headline: string; primary_text: string }[];
        } | undefined;
        delete fullPayload._ad_variation_data;

        const { data: newItem, error: insertError } = await supabase
          .from('review_items')
          .insert(fullPayload)
          .select('id')
          .single();

        if (insertError || !newItem) {
          toast.error('Failed to create item');
          setUploading(false);
          return;
        }

        if (itemPayload.type === 'ad' && adVariationData) {
          try {
            const { existing_variation_ids, new_variations } = adVariationData;
            let allVariationIds = [...existing_variation_ids];
            if (new_variations.length > 0) {
              const createRes = await authFetch(
                `/api/campaigns/${projectId}/ad-variations`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ variations: new_variations }),
                },
              );
              if (createRes.ok) {
                const { variations: created } = await createRes.json();
                allVariationIds = [...allVariationIds, ...created.map((v: { id: string }) => v.id)];
              }
            }
            if (allVariationIds.length > 0) {
              await authFetch(
                `/api/campaigns/${projectId}/ad-variations/link`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    review_item_id: newItem.id,
                    variation_ids: allVariationIds,
                  }),
                },
              );
            }
          } catch { /* non-fatal */ }
        }

        toast.success('Asset created');
        onSuccess();
        onClose();
        router.push(`/campaigns/${projectId}/review`);
      } catch {
        toast.error('Something went wrong');
        setUploading(false);
      }
    },
    [companyId, userId, title, itemType, reviewCheck, toast, router, onSuccess, onClose],
  );

  const submitPayload = useCallback(
    (payload: Record<string, unknown>) => createProjectAndItem(payload),
    [createProjectAndItem],
  );

  const submitWithFile = useCallback(
    (payload: Record<string, unknown>, file: File) => createProjectAndItem(payload, file),
    [createProjectAndItem],
  );

  const uploadAsset = useCallback(
    async (file: File): Promise<string | null> => {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `reviews/${companyId}/temp/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        toast.error('Failed to upload file');
        return null;
      }
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path);
      return urlData.publicUrl;
    },
    [companyId, toast],
  );

  const activeCat = CATEGORIES.find((c) => c.key === selectedCategory);
  const isMetaAd = step === 'details' && itemType === 'ad';
  const modalSize = isMetaAd ? 'full' : (isWide ? 'xl' : 'lg');

  const modalTitle = step === 'category'
    ? 'New Asset'
    : step === 'subtype'
      ? activeCat?.label ?? 'Choose Type'
      : (TITLES[itemType] || 'New Asset');

  return (
    <Modal open onClose={onClose} title={modalTitle} size={modalSize}>
      {/* Step 1: Choose category */}
      {step === 'category' && (
        <Modal.Body className="space-y-2">
          <p className="text-xs text-faint mb-3">
            Create a standalone asset for quick review — no campaign setup needed.
          </p>
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

      {/* Step 2: Choose subtype */}
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

      {/* Step 3: Title + type-specific form */}
      {step === 'details' && (
        <>
          {/* Title field injected before the form */}
          <div className="px-6 pt-4 pb-0">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-xs font-medium text-faint hover:text-teal transition-colors mb-3"
            >
              <ArrowLeft size={13} />
              Change type
            </button>
            <div>
              <label className="block text-sm font-medium text-prose mb-1.5">
                Asset Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={TITLES[itemType] ?? 'Untitled Asset'}
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
                autoFocus
              />
              <p className="text-xs text-faint mt-1">
                Optional — defaults to the asset type name.
              </p>
            </div>
          </div>

          {itemType === 'image' && (
            <ImageItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'ad' && (
            <AdItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} onPreviewChange={handlePreviewChange} />
          )}
          {itemType === 'email' && (
            <EmailItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'sms' && (
            <SmsItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'webpage' && (
            <WebpageItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'video' && (
            <VideoItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'pdf' && (
            <PdfItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'google_search_ad' && (
            <GoogleSearchAdItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'google_banner_ad' && (
            <GoogleBannerAdItemForm onSubmit={submitWithFile} onBack={handleBack} onCancel={onClose} uploading={uploading} />
          )}
          {itemType === 'meta_lead_form' && (
            <MetaLeadFormItemForm onSubmit={submitPayload} onBack={handleBack} onCancel={onClose} uploading={uploading} onUploadAsset={uploadAsset} />
          )}
        </>
      )}
    </Modal>
  );
}
