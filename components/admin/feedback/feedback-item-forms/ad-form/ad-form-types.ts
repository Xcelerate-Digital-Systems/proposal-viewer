export const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

export type PickerVariation = {
  id: string;
  label: string;
  headline: string;
  primary_text: string;
  isExisting: boolean;
  selected: boolean;
  usedByCount?: number;
};

export interface AdItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
  reviewProjectId?: string;
  companyId?: string;
}

export function newTempId(): string {
  return `new-${crypto.randomUUID().slice(0, 8)}`;
}

export function newInlineVariation(): PickerVariation {
  return { id: newTempId(), label: '', headline: '', primary_text: '', isExisting: false, selected: true };
}
