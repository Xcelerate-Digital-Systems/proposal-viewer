-- ============================================================================
-- Per-item preview preference
-- ============================================================================
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Adds a boolean flag on review_items so users can opt a specific webpage
-- item out of the live iframe preview (e.g. when the target site blocks
-- framing via X-Frame-Options / CSP) and use its saved screenshot instead.
--
--   false (default) → render live iframe when URL is set
--   true            → render screenshot_url (falls back to iframe if none)

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS prefer_screenshot BOOLEAN NOT NULL DEFAULT FALSE;
