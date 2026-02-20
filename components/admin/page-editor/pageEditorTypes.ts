// components/admin/page-editor/pageEditorTypes.ts

import { PageNameEntry, PricingLineItem, PricingOptionalItem } from '@/lib/supabase';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type UnifiedItem = {
  id: string;
  type: 'pdf' | 'pricing';
  pdfIndex: number;
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
}

/* ─── Constants ─────────────────────────────────────────────────────── */

export const PRESET_LABELS = [
  'INTRODUCTION', 'TABLE OF CONTENTS', 'EXECUTIVE SUMMARY', 'WHO ARE WE',
  'ABOUT US', 'OUR APPROACH', 'YOUR SOLUTION', 'SERVICES', 'SCOPE OF WORK',
  'HOW WE GET RESULTS', 'METHODOLOGY', 'DELIVERABLES', 'CASE STUDIES',
  'CASE STUDY', 'TESTIMONIALS', 'YOUR INVESTMENT', 'PRICING', 'TIMELINE',
  'FAQ', 'TERMS & CONDITIONS', 'NEXT STEPS', 'CONTACT', 'APPENDIX',
];

export const CUSTOM_VALUE = '__custom__';

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

/* ─── Helpers ───────────────────────────────────────────────────────── */

export const isPreset = (name: string) => PRESET_LABELS.includes(name.toUpperCase());