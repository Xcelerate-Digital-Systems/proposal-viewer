-- Add default_deal_value to funnels table
-- Allows agencies to set a funnel-level "average deal value" that steps
-- inherit when they don't have their own metrics.value set.
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS default_deal_value numeric DEFAULT NULL;
