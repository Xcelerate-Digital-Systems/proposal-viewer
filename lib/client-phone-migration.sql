-- Add client_phone column to proposals table.
-- Already applied to production via execute_sql on 2026-07-29.
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_phone text;
