-- Add require_signature to proposal_templates so the signature toggle
-- can be saved on templates (mirrors the proposals.require_signature column).

ALTER TABLE proposal_templates
  ADD COLUMN IF NOT EXISTS require_signature boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN proposal_templates.require_signature IS 'When true, proposals created from this template default to requiring e-signature';
