-- Add cover_gradient_stops to proposal_templates (already exists on proposals).
-- This column was missing, causing get_template_design to fail with a query error
-- that was swallowed as "Template not found".
ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS cover_gradient_stops jsonb DEFAULT NULL;
