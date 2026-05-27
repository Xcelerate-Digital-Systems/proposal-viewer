-- In-app notification center.
--
-- Each row is one notification for one team member. Notifications are
-- written by the server when proposal or review events fire, alongside
-- the existing email dispatch. The admin UI reads them via API routes
-- that enforce company_id scoping.

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Coarse category for icon / filter in the UI.
  category text NOT NULL CHECK (category IN (
    'proposal_viewed', 'proposal_accepted', 'proposal_declined',
    'proposal_revision_requested', 'comment_added', 'comment_resolved',
    'review_comment', 'review_status', 'review_new_version',
    'review_complete', 'mention'
  )),
  title text NOT NULL,
  body text,
  -- Deep-link path (relative to app root, e.g. "/proposals/abc123").
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path: unread count badge per user.
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread
  ON public.in_app_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Feed query: all notifications for a user, newest first.
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_feed
  ON public.in_app_notifications (user_id, created_at DESC);

-- Company-scoped cleanup.
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_company
  ON public.in_app_notifications (company_id);

-- RLS: users can only read/update their own notifications.
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.in_app_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.in_app_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only service_role inserts (from API routes).
REVOKE INSERT ON public.in_app_notifications FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.in_app_notifications TO service_role;

-- Authenticated can select + update (mark read); service_role has all.
GRANT SELECT, UPDATE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;

-- Enable realtime so the bell badge updates live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
