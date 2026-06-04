-- Move decision design colours to company level so they apply globally
-- across proposals, quotes, and templates. Per-entity overrides remain
-- in proposals / proposal_templates for any legacy rows that have them.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS decision_action_bg_color      text,
  ADD COLUMN IF NOT EXISTS decision_action_text_color    text,
  ADD COLUMN IF NOT EXISTS decision_action_heading_color text,
  ADD COLUMN IF NOT EXISTS decision_action_accent_color  text,
  ADD COLUMN IF NOT EXISTS decision_decline_button_color text,
  ADD COLUMN IF NOT EXISTS decision_revision_button_color text,
  ADD COLUMN IF NOT EXISTS decision_checkbox_color       text;
