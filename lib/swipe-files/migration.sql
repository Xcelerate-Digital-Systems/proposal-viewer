-- Swipe File — Database Migration
-- Single-level Ad Type folders, with free-form angle tags on each swipe.

-- ─── 1. Swipe Types (folders, e.g. "Image + Headline Overlay") ─────────────

CREATE TABLE swipe_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  share_token UUID UNIQUE DEFAULT gen_random_uuid(),
  public_share_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_swipe_types_company ON swipe_types(company_id);
CREATE INDEX idx_swipe_types_share_token ON swipe_types(share_token);

-- ─── 2. Swipe Files (Meta ad references with angle tags) ───────────────────

CREATE TABLE swipe_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES swipe_types(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  notes TEXT,

  -- Meta ad copy
  headline TEXT,
  primary_text TEXT,
  description TEXT,
  cta TEXT,

  -- Free-form angle tags (e.g. "Social Proof", "Pain/Agitation", "Before/After")
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Media: uploaded to Supabase storage OR pasted external URL
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  media_url TEXT,
  media_source TEXT CHECK (media_source IN ('upload', 'external')),
  thumbnail_url TEXT,
  source_url TEXT,
  brand TEXT,

  share_token UUID UNIQUE DEFAULT gen_random_uuid(),
  public_share_enabled BOOLEAN NOT NULL DEFAULT false,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_swipe_files_company ON swipe_files(company_id);
CREATE INDEX idx_swipe_files_type ON swipe_files(type_id);
CREATE INDEX idx_swipe_files_share_token ON swipe_files(share_token);
CREATE INDEX idx_swipe_files_tags ON swipe_files USING GIN (tags);
