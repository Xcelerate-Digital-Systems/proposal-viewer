-- Funnel node messages — lets an email/SMS node carry the actual message that
-- would be sent, so a funnel doubles as the place the copy lives.
--
-- Stored as jsonb rather than folded into funnel_board_shapes.content because
-- `content` already holds the shape's serialized label/config and is parsed by
-- shared helpers in components/admin/feedback/board/nodes/shape-parsers.ts,
-- which drop unknown keys. A separate column keeps the feedback whiteboard
-- untouched.
--
-- Shape: { "kind": "email"|"sms", "from": text, "subject": text,
--          "preheader": text, "body": text }
-- NULL means "this node has no message attached".

ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS message jsonb;

ALTER TABLE public.funnel_board_shapes
  ADD COLUMN IF NOT EXISTS message jsonb;

-- No RLS changes needed: both tables are already tenant-scoped by the
-- "Team members manage …" policies, and the public viewer reads them through
-- the SECURITY DEFINER get_funnel_data(p_token) RPC, which does SELECT * and
-- therefore picks the column up automatically.
--
-- Note this makes message bodies readable by anyone holding a funnel's share
-- link, which is the intended behaviour — funnel shares are unguessable tokens
-- but are not otherwise access-controlled.
