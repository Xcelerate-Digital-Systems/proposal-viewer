-- Add linked_funnel_id to funnel_steps and funnel_board_shapes.
-- Allows any step or shape node to link to a different funnel —
-- clicking it navigates to that funnel's board.

ALTER TABLE funnel_steps
  ADD COLUMN IF NOT EXISTS linked_funnel_id uuid
  REFERENCES funnels(id) ON DELETE SET NULL;

ALTER TABLE funnel_board_shapes
  ADD COLUMN IF NOT EXISTS linked_funnel_id uuid
  REFERENCES funnels(id) ON DELETE SET NULL;
