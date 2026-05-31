-- Add currency column to proposals table for multi-currency quoting.
-- Defaults to 'AUD' for backwards compatibility with existing proposals.
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AUD';

COMMENT ON COLUMN proposals.currency IS 'ISO 4217 currency code for quote pricing (e.g. AUD, USD, GBP, EUR)';
