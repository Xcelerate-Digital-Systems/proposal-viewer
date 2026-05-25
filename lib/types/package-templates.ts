// lib/types/package-templates.ts
import type { PackageTier } from './packages';

export interface PackageTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  tier: PackageTier;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  tier: PackageTier;
  created_at: string;
}
