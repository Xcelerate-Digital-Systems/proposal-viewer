-- Add pricing accent bar and dot-point colour overrides to proposals + templates.
-- These let users control the top border bar and bullet dots on the pricing page
-- from the Design tab's Pricing Design card, instead of always inheriting from
-- the company accent colour.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS pricing_accent_bar_color text,
  ADD COLUMN IF NOT EXISTS pricing_dot_color text;

ALTER TABLE proposal_templates
  ADD COLUMN IF NOT EXISTS pricing_accent_bar_color text,
  ADD COLUMN IF NOT EXISTS pricing_dot_color text;
