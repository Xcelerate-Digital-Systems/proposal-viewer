// components/admin/page-editor/pageEditorTypes.ts

import type { UnifiedPage, PageType } from '@/lib/page-operations';
import type {
  PricingLineItem,
  PricingOptionalItem,
  PaymentSchedule,
} from '@/lib/supabase';

/* ──────────────────────────────────────────────────────────────────────────
 * Re-export the canonical types from lib so component files only need one
 * import location.
 * ──────────────────────────────────────────────────────────────────────── */

export type { UnifiedPage, PageType };

/* ──────────────────────────────────────────────────────────────────────────
 * TextPageData — form shape used by TextPageEditorModal.
 * Mirrors the text-page fields stored on a UnifiedPage row.
 * ──────────────────────────────────────────────────────────────────────── */

export interface TextPageData {
  id:                    string;
  title:                 string;
  show_title:            boolean;
  show_member_badge:     boolean;
  show_client_logo:      boolean;
  prepared_by_member_id: string | null;
  content:               unknown; // Tiptap JSON
}

/* ──────────────────────────────────────────────────────────────────────────
 * PricingFormState — local form shape used by PricingPanel and callers.
 * Mirrors the pricing payload fields stored in UnifiedPage.payload.
 * ──────────────────────────────────────────────────────────────────────── */

export interface PricingFormState {
  title:           string;
  introText:       string;
  items:           PricingLineItem[];
  optionalItems:   PricingOptionalItem[];
  paymentSchedule: PaymentSchedule;
  taxEnabled:      boolean;
  taxRate:         number;
  taxLabel:        string;
  validityDays:    number | null;
  proposalDate:    string | null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * PageEditorProps — public API consumed by callers
 *
 * filePath / initialPageNames are kept for backward-compat but are no longer
 * used by the refactored PageEditor (pages come from the v2 DB tables).
 * ──────────────────────────────────────────────────────────────────────── */

export interface PageEditorProps {
  proposalId:        string;
  filePath?:         string;       // kept for compat; ignored
  initialPageNames?: unknown[];    // kept for compat; ignored
  onSave:            () => void;
  onCancel?:         () => void;
  tableName?:        'proposals' | 'documents' | 'templates';
}