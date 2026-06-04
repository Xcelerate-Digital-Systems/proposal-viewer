-- Add bg_divider column to companies table
-- Stores the explicit divider/line colour for client-facing viewers.
-- NULL = auto-derive from bg_secondary (backwards compat).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bg_divider text;