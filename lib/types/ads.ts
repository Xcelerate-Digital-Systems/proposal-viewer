// lib/types/ads.ts

// ─── Ad Tracker types ────────────────────────────────────────────────────────

export type AdTrackerStatus = 'active' | 'archived';

export type AdTracker = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  status: AdTrackerStatus;
  standards: TrackerStandards;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Ad Creative types ───────────────────────────────────────────────────────

export type AwarenessLevel =
  | 'unaware'
  | 'problem_aware'
  | 'solution_aware'
  | 'product_aware'
  | 'most_aware';

export type MarketSophistication =
  | 'simple_claim'
  | 'enlarged_claim'
  | 'unique_mechanism'
  | 'proof_heavy'
  | 'contrarian';

export type AdIterationType = 'new' | 'iteration';
export type AdMediaType = 'still' | 'video';

export type AdCreativeStatus =
  | 'draft'
  | 'briefed'
  | 'in_production'
  | 'ready'
  | 'live'
  | 'paused'
  | 'killed';

export type AdWinnerStatus =
  | 'yes'
  | 'no'
  | 'didnt_win'
  | 'scaled'
  | 'stopped'
  | 'fatigued';

export type AdCreative = {
  id: string;
  company_id: string;
  tracker_id: string;
  ad_name: string;
  image_url: string | null;
  // Strategy
  signal: string | null;
  hypothesis: string | null;
  ad_concept: string | null;
  angle_family: string | null;
  angle_idea: string | null;
  // Audience
  target_market: string | null;
  awareness_level: AwarenessLevel | null;
  market_sophistication: MarketSophistication | null;
  // Destination
  offer_variant: string | null;
  lander_variant: string | null;
  // Execution
  iteration_type: AdIterationType | null;
  media_type: AdMediaType | null;
  creative_style: string | null;
  creative_format: string | null;
  hook: string | null;
  persona: string | null;
  status: AdCreativeStatus;
  brief_link: string | null;
  creative_link: string | null;
  ad_copy_link: string | null;
  // Results
  winner: AdWinnerStatus | null;
  launch_date: string | null;
  analysis_date: string | null;
  kill_date: string | null;
  creative_lifespan_days: number | null;
  hook_rate: number | null;
  hold_rate: number | null;
  uctr: number | null;
  cvr: number | null;
  cpl: number | null;
  cpl_label: string;
  next_action: string | null;
  // Meta
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Ad Copy Variant types ───────────────────────────────────────────────────

export type AdCopyVariantType = 'headline' | 'primary_text' | 'description' | 'cta';

export type AdCopyVariant = {
  id: string;
  ad_creative_id: string;
  variant_type: AdCopyVariantType;
  label: string;
  content: string;
  sort_order: number;
  created_at: string;
};

// ─── Reference data types ────────────────────────────────────────────────────

export type AdAngleFamily = {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  description: string | null;
  example_hooks: string[];
  sort_order: number;
  created_at: string;
};

export type AdCreativeFormat = {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type AdTargetMarket = {
  id: string;
  company_id: string;
  tracker_id: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

// ─── Extended types (with relations) ─────────────────────────────────────────

export type AdCreativeWithVariants = AdCreative & {
  ad_copy_variants: AdCopyVariant[];
};

export type AdTrackerWithCount = AdTracker & {
  creative_count: number;
};

// ─── Performance Standards ──────────────────────────────────────────────────

export type TrackerStandards = {
  cpl_target?: number | null;
  metric_label?: string; // e.g. "CPL", "CPA", "ROAS"
  /** Personas this campaign targets — used in the ad naming convention. */
  personas?: string[];
};

export type AdAccountStandards = {
  id: string;
  company_id: string;
  hook_rate_target: number | null;
  hold_rate_target: number | null;
  uctr_target: number | null;
  created_at: string;
  updated_at: string;
};
