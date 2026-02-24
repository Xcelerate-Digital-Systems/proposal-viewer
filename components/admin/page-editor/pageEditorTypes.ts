// components/admin/page-editor/pageEditorTypes.ts

import { PageNameEntry, PricingLineItem, PricingOptionalItem } from '@/lib/supabase';

/* ——— Types ——————————————————————————————————————————————————— */

export type UnifiedItem = {
  id: string;
  type: 'pdf' | 'pricing' | 'text' | 'group';
  pdfIndex: number;
  textPageId?: string; // UUID of the text page record
  entryIndex?: number; // Index in entries array (for groups)
};

export type PricingFormState = {
  enabled: boolean;
  title: string;
  introText: string;
  items: PricingLineItem[];
  optionalItems: PricingOptionalItem[];
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  validityDays: number | null;
  proposalDate: string;
};

export interface PageEditorProps {
  proposalId: string;
  filePath: string;
  initialPageNames: (PageNameEntry | string)[];
  onSave: () => void;
  onCancel: () => void;
  tableName?: 'proposals' | 'documents';
}

/* ——— Constants ——————————————————————————————————————————————— */

export const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

export const DEFAULT_PRICING: PricingFormState = {
  enabled: true,
  title: 'Project Investment',
  introText: DEFAULT_INTRO,
  items: [],
  optionalItems: [],
  taxEnabled: true,
  taxRate: 10,
  taxLabel: 'GST (10%)',
  validityDays: 30,
  proposalDate: new Date().toISOString().split('T')[0],
};