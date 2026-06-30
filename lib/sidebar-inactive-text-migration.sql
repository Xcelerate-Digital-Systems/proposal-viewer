-- Add sidebar_inactive_text_color to companies table
-- Nullable: NULL = auto-derive from bgPrimary (existing behaviour)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sidebar_inactive_text_color text DEFAULT NULL;
