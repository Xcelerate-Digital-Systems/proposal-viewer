-- Waitlist for prospects who land on /pricing while public signup is
-- still gated (PUBLIC_SIGNUP_ENABLED=false). Once you flip the flag, the
-- pricing page swaps its CTA to "Start free trial" and this table stops
-- growing — but keep the rows around as a prospect list for outreach.
--
-- RLS: anon can INSERT only. Service role reads. The pricing form posts
-- through /api/waitlist (service-role insert with rate-limit) rather than
-- letting anon write directly, so abuse mitigation lives at the route layer.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  agency_name  text NULL,
  source       text NULL,
  ip           text NULL,
  user_agent   text NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- No policies — service role only. Anon clients cannot INSERT / SELECT /
-- UPDATE / DELETE; the /api/waitlist route mediates writes from the
-- pricing form using the service-role client + per-IP rate limit.
