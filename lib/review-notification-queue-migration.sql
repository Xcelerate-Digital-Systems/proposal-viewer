-- Review notification digest queue.
--
-- Comment notifications (new comments + replies) are enqueued here instead of
-- being sent immediately. A cron worker
-- (POST /api/cron/flush-review-notifications) groups rows older than 5 minutes
-- by (recipient_email, review_project_id) and sends a single digest email.
--
-- Status events (approved / revision needed / resolved / new version / review
-- complete) still send immediately — only comment-chatter is batched.

CREATE TABLE IF NOT EXISTS public.pending_review_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  review_project_id uuid NOT NULL REFERENCES public.review_projects(id) ON DELETE CASCADE,
  review_item_id uuid REFERENCES public.review_items(id) ON DELETE SET NULL,
  review_comment_id uuid,
  event_type text NOT NULL,
  -- payload captures everything the digest builder needs without re-querying:
  -- { item_title, comment_author, comment_content, screenshot_url, parent_comment_id, parent_author, parent_content, is_reply }
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The flush worker only picks rows where dispatch_after <= now().
  dispatch_after timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  dispatched_at timestamptz
);

-- Worker query hot path.
CREATE INDEX IF NOT EXISTS idx_pending_review_notifications_due
  ON public.pending_review_notifications (dispatch_after)
  WHERE dispatched_at IS NULL;

-- Groups rows per recipient + project at flush time.
CREATE INDEX IF NOT EXISTS idx_pending_review_notifications_group
  ON public.pending_review_notifications (recipient_email, review_project_id)
  WHERE dispatched_at IS NULL;

-- Server-only — no anon/authenticated reads.
ALTER TABLE public.pending_review_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_review_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pending_review_notifications TO service_role;
