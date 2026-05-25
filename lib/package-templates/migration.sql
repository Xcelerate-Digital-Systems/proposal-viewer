-- Package templates — reusable individual package tiers that team members
-- can save from a proposal's packages page and reload into another. Powers
-- the PackagesTabEditor "From Library" / "Save as Template" buttons.
--
-- A template stores a single PackageTier (one card), not the full set; the
-- editor regenerates a fresh id on load so the same template can be inserted
-- multiple times across proposals without collisions.

CREATE TABLE IF NOT EXISTS package_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tier JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_templates_company
  ON package_templates(company_id);

ALTER TABLE package_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "package_templates_select_own_company" ON package_templates;
CREATE POLICY "package_templates_select_own_company" ON package_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM team_members WHERE user_id = auth.uid()
    )
  );
