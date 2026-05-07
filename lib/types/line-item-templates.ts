// lib/types/line-item-templates.ts
import type { PricingLineItem } from './packages';

export interface LineItemTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  items: PricingLineItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineItemTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
  created_at: string;
}
