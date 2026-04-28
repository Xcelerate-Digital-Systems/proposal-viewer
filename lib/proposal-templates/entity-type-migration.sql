-- lib/proposal-templates/entity-type-migration.sql
-- Adds entity_type to proposal_templates so templates can target either
-- proposals or quotes. Existing rows default to 'proposal'.
--
-- Run once in the Supabase SQL editor.

ALTER TABLE proposal_templates
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'proposal';

ALTER TABLE proposal_templates
  DROP CONSTRAINT IF EXISTS proposal_templates_entity_type_check;

ALTER TABLE proposal_templates
  ADD CONSTRAINT proposal_templates_entity_type_check
  CHECK (entity_type IN ('proposal', 'quote'));

CREATE INDEX IF NOT EXISTS proposal_templates_entity_type_idx
  ON proposal_templates (company_id, entity_type);
