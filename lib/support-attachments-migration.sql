-- Add screenshot attachments and Loom URL support to support tickets.
-- Run this migration against your Supabase project.

alter table public.support_tickets
  add column if not exists loom_url text default null,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- attachments is an array of { url, name, type, size } objects,
-- matching the shape returned by the upload endpoint.
