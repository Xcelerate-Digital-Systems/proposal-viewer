-- Increase comment digest batching window from 5 minutes to 10 minutes.
ALTER TABLE public.pending_review_notifications
  ALTER COLUMN dispatch_after SET DEFAULT (now() + interval '10 minutes');
