-- Pin context columns on review_comments
-- Stores viewport width and DOM anchor at pin creation time so pin
-- coordinates are interpretable regardless of responsive reflow.

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS viewport_width smallint,
  ADD COLUMN IF NOT EXISTS pin_element_selector text,
  ADD COLUMN IF NOT EXISTS pin_anchor_text text;

COMMENT ON COLUMN review_comments.viewport_width IS 'window.innerWidth at pin creation time';
COMMENT ON COLUMN review_comments.pin_element_selector IS 'CSS selector path from pin target to content container';
COMMENT ON COLUMN review_comments.pin_anchor_text IS 'First ~120 chars of nearest text at pin location';
