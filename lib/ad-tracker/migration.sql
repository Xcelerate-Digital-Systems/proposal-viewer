-- Ad Creative Tracker — Database Migration
-- Run this in the Supabase SQL Editor

-- ─── 1. Ad Trackers (replaces spreadsheet tabs) ─────────────────────────────

CREATE TABLE ad_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES companies(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_trackers_company ON ad_trackers(company_id);

-- ─── 2. Ad Creatives (main tracking table) ──────────────────────────────────

CREATE TABLE ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tracker_id UUID NOT NULL REFERENCES ad_trackers(id) ON DELETE CASCADE,
  ad_name TEXT NOT NULL,
  image_url TEXT,

  -- Strategy
  signal TEXT,
  hypothesis TEXT,
  ad_concept TEXT,
  angle_family TEXT,
  angle_idea TEXT,

  -- Audience
  target_market TEXT,
  awareness_level TEXT CHECK (awareness_level IN ('unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware')),
  market_sophistication TEXT CHECK (market_sophistication IN ('simple_claim', 'enlarged_claim', 'unique_mechanism', 'proof_heavy', 'contrarian')),

  -- Destination
  offer_variant TEXT,
  lander_variant TEXT,

  -- Execution
  iteration_type TEXT CHECK (iteration_type IN ('new', 'iteration')),
  media_type TEXT CHECK (media_type IN ('still', 'video')),
  creative_style TEXT,
  creative_format TEXT,
  hook TEXT,
  persona TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'briefed', 'in_production', 'ready', 'live', 'paused', 'killed')),
  brief_link TEXT,
  creative_link TEXT,

  -- Results
  winner TEXT CHECK (winner IN ('yes', 'no', 'didnt_win', 'scaled', 'stopped', 'fatigued')),
  launch_date DATE,
  analysis_date DATE,
  kill_date DATE,
  creative_lifespan_days INTEGER,
  hook_rate NUMERIC(7,4),
  hold_rate NUMERIC(7,4),
  uctr NUMERIC(7,4),
  cvr NUMERIC(7,4),
  cpl NUMERIC(12,2),
  cpl_label TEXT NOT NULL DEFAULT 'CPL',
  next_action TEXT,

  -- Meta
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_creatives_company ON ad_creatives(company_id);
CREATE INDEX idx_ad_creatives_tracker ON ad_creatives(tracker_id);
CREATE INDEX idx_ad_creatives_status ON ad_creatives(company_id, status);

-- ─── 3. Ad Copy Variants ────────────────────────────────────────────────────

CREATE TABLE ad_copy_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_creative_id UUID NOT NULL REFERENCES ad_creatives(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL CHECK (variant_type IN ('headline', 'primary_text', 'description', 'cta')),
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_copy_variants_creative ON ad_copy_variants(ad_creative_id);

-- ─── 4. Ad Angle Families (reference data) ──────────────────────────────────

CREATE TABLE ad_angle_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  example_hooks TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_angle_families_company ON ad_angle_families(company_id);

-- ─── 5. Ad Creative Formats (reference data) ────────────────────────────────

CREATE TABLE ad_creative_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_creative_formats_company ON ad_creative_formats(company_id);

-- ─── 6. Migration: persona + rename video_hooks → hook ──────────────────────
-- Run on existing databases (idempotent).

ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS persona TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_creatives' AND column_name = 'video_hooks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_creatives' AND column_name = 'hook'
  ) THEN
    ALTER TABLE ad_creatives RENAME COLUMN video_hooks TO hook;
  END IF;
END $$;
