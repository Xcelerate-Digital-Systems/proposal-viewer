import type { FeedbackItem, FeedbackItemVersion } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/types/feedback';
import type { VersionView } from '@/lib/feedback/versions';

/* ─── Props ──────────────────────────────────────────────────────── */

export interface AddVersionModalProps {
  item: FeedbackItem;
  nextVersionNumber: number;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: {
    notes?: string | null;
    assets: Partial<FeedbackItemVersion>;
    resetToStage?: FeedbackStatus | null;
  }) => Promise<FeedbackItemVersion | null>;
  onUploadAsset: (file: File) => Promise<string | null>;
  editingVersion?: VersionView;
  onUpdate?: (
    versionId: string | null,
    patch: { notes?: string | null; assets: Partial<FeedbackItemVersion> }
  ) => Promise<boolean>;
}

/* ─── Discriminated asset kind ───────────────────────────────────── */

export type AssetKind = 'file' | 'text' | 'ad' | 'google_search_ad' | 'google_banner_ad' | 'meta_lead_form' | 'figma';

export function assetKindForType(type: FeedbackItem['type']): AssetKind {
  if (type === 'email' || type === 'sms') return 'text';
  if (type === 'ad') return 'ad';
  if (type === 'google_search_ad') return 'google_search_ad';
  if (type === 'google_banner_ad') return 'google_banner_ad';
  if (type === 'meta_lead_form') return 'meta_lead_form';
  if (type === 'figma') return 'figma';
  return 'file';
}

export function fileAccept(type: FeedbackItem['type']): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'pdf') return 'application/pdf';
  if (type === 'ad' || type === 'google_banner_ad' || type === 'meta_lead_form') return 'image/*';
  return '*';
}

export function fileTargetField(type: FeedbackItem['type']): keyof FeedbackItemVersion {
  if (type === 'image') return 'image_url';
  if (type === 'video') return 'video_url';
  if (type === 'pdf') return 'pdf_url';
  return 'ad_creative_url';
}

/* ─── Variation picker ───────────────────────────────────────────── */

export type PickerVariation = {
  id: string; label: string; headline: string; primary_text: string;
  isExisting: boolean; selected: boolean; usedByCount?: number;
};

export function newVariantId(): string { return crypto.randomUUID().slice(0, 8); }

export function newAdVariant() {
  return { id: newVariantId(), label: '', primary_text: '', headline: '' };
}

export function newTempVariation(): PickerVariation {
  return { id: `new-${crypto.randomUUID().slice(0, 8)}`, label: '', headline: '', primary_text: '', isExisting: false, selected: true };
}

/* ─── Constants ──────────────────────────────────────────────────── */

export const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

export const MAX_GAD_HEADLINES = 15;
export const MAX_GAD_DESCRIPTIONS = 4;
export const GAD_HEADLINE_CHARS = 30;
export const GAD_DESCRIPTION_CHARS = 90;

export const inputCls = 'w-full px-3 py-2 bg-surface rounded-2xl text-caption focus:outline-none focus:ring-2 focus:ring-teal/30';

export const RESET_OPTIONS: { value: FeedbackStatus | 'keep'; label: string }[] = [
  { value: 'client_review', label: 'Send to Client Review' },
  { value: 'internal_review', label: 'Send to Internal Review' },
  { value: 'keep', label: 'Keep current stage' },
];
