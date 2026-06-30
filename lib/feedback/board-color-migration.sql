-- Add board_color column to review_items for custom node colours on the whiteboard.
-- Nullable text; null means use the default type tint.

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS board_color text DEFAULT NULL;
