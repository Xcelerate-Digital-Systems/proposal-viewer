-- Add description column to funnel_steps, funnel_board_shapes, and
-- funnel_board_notes for inline node descriptions (Puzzle-style info cards
-- toggled per node).

ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

ALTER TABLE public.funnel_board_shapes
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

ALTER TABLE public.funnel_board_notes
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

-- get_funnel_data does SELECT * on all three tables, so no RPC changes needed.
