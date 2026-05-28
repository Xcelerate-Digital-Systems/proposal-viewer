-- Migration: Add decision button + checkbox colour columns to proposals and proposal_templates.
-- These columns let the Design tab control per-button colours on the
-- Accept/Decline/Request Changes form, plus the checkbox accent colour.
--
-- Existing columns already on both tables:
--   decision_action_bg_color, decision_action_text_color,
--   decision_action_heading_color, decision_action_accent_color
--
-- New columns:
--   decision_decline_button_color  — Decline button bg (NULL = hardcoded red)
--   decision_revision_button_color — Request Changes button bg (NULL = heading colour)
--   decision_checkbox_color        — Checkbox accent (NULL = browser default)

-- ── proposals ────────────────────────────────────────────────────────────────

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS decision_decline_button_color  text,
  ADD COLUMN IF NOT EXISTS decision_revision_button_color text,
  ADD COLUMN IF NOT EXISTS decision_checkbox_color        text;

-- ── proposal_templates ───────────────────────────────────────────────────────

ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS decision_decline_button_color  text,
  ADD COLUMN IF NOT EXISTS decision_revision_button_color text,
  ADD COLUMN IF NOT EXISTS decision_checkbox_color        text;

-- Also ensure the older decision_action_* columns exist on proposal_templates
-- (they were added to proposals first; templates may be missing them).

ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS decision_action_bg_color      text,
  ADD COLUMN IF NOT EXISTS decision_action_text_color    text,
  ADD COLUMN IF NOT EXISTS decision_action_heading_color text,
  ADD COLUMN IF NOT EXISTS decision_action_accent_color  text;
