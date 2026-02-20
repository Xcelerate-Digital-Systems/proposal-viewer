// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type PageNameEntry = {
  name: string;
  indent: number; // 0 = top level, 1 = nested child
};

/**
 * Normalize page_names from DB into PageNameEntry[].
 * Handles both legacy string[] and new {name, indent}[] formats.
 */
export function normalizePageNames(raw: unknown, count: number): PageNameEntry[] {
  const result: PageNameEntry[] = [];

  if (Array.isArray(raw)) {
    for (let i = 0; i < count; i++) {
      const item = raw[i];
      if (item && typeof item === 'object' && 'name' in item) {
        result.push({ name: item.name || `Page ${i + 1}`, indent: item.indent || 0 });
      } else if (typeof item === 'string') {
        result.push({ name: item, indent: 0 });
      } else {
        result.push({ name: `Page ${i + 1}`, indent: 0 });
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      result.push({ name: `Page ${i + 1}`, indent: 0 });
    }
  }

  return result.slice(0, count);
}

export type Proposal = {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  description: string | null;
  file_path: string;
  file_size_bytes: number | null;
  share_token: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  accepted_by_name: string | null;
  page_names: PageNameEntry[] | string[];
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string;
  accept_button_text: string | null;
  post_accept_action: 'redirect' | 'message' | null;
  post_accept_redirect_url: string | null;
  post_accept_message: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
};

export type ProposalComment = {
  id: string;
  proposal_id: string;
  author_name: string;
  content: string;
  page_number: number | null;
  is_internal: boolean;
  parent_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  company_id: string;
  created_at: string;
};

export type ProposalTemplate = {
  id: string;
  name: string;
  description: string | null;
  page_count: number;
  cover_image_path: string | null;
  cover_enabled: boolean;
  cover_subtitle: string | null;
  cover_button_text: string;
  company_id: string;
  created_at: string;
  updated_at: string;
};

export type TemplatePage = {
  id: string;
  template_id: string;
  page_number: number;
  file_path: string;
  label: string;
  indent: number; // 0 = top level, 1 = nested child (matches PageNameEntry)
  company_id: string;
  created_at: string;
};

export type TeamMember = {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  is_super_admin: boolean;
  notify_proposal_viewed: boolean;
  notify_proposal_accepted: boolean;
  notify_comment_added: boolean;
  notify_comment_resolved: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookEndpoint = {
  id: string;
  company_id: string;
  event_type: 'proposal_viewed' | 'proposal_accepted' | 'comment_added' | 'comment_resolved';
  url: string;
  secret: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// ─── Pricing types ───────────────────────────────────────────────────────────

export type PricingLineItem = {
  id: string;
  label: string;
  description: string;
  percentage: number;
  amount: number;
  sort_order: number;
};

export type PricingOptionalItem = {
  id: string;
  label: string;
  description: string;
  amount: number;
  sort_order: number;
};

export type ProposalPricing = {
  id: string;
  proposal_id: string;
  company_id: string;
  enabled: boolean;
  position: number; // -1 = last page, otherwise 0-indexed insert position
  title: string;
  intro_text: string | null;
  items: PricingLineItem[];
  optional_items: PricingOptionalItem[];
  tax_enabled: boolean;
  tax_rate: number;
  tax_label: string;
  validity_days: number | null;
  proposal_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplatePricing = Omit<ProposalPricing, 'proposal_id' | 'proposal_date'> & {
  template_id: string;
};

/** Helper: compute subtotal from line items */
export function pricingSubtotal(items: PricingLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Helper: compute tax amount */
export function pricingTax(subtotal: number, rate: number): number {
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

/** Helper: format AUD currency */
export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Helper: generate a short unique id for line items */
export function generateItemId(): string {
  return Math.random().toString(36).substring(2, 10);
}