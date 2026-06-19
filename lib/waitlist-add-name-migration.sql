-- Add a name column to the waitlist table so we capture the person's name
-- alongside their email and agency name.
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS name text NULL;
