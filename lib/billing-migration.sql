-- Stripe billing tables. Companion to the launch plan at
-- /Users/jackburton/.claude/plans/can-you-help-me-valiant-whisper.md.
--
-- Design notes
--   * Every billing row is service-role-only (RLS deny-all, mirroring the
--     ai_usage pattern). The /api/billing/* routes verify the caller and
--     query through the service client, so nothing here is exposed via
--     PostgREST to anon/authenticated clients.
--   * `plans` is intentionally a real DB table (not a constant in code) so
--     we can grandfather pricing — when the founders price closes, we
--     insert a new plan row + flip `is_active`; existing subscribers keep
--     their original `subscriptions.plan_id` pointing at the founders row,
--     and Stripe keeps charging them on the founders price id forever.
--   * `stripe_webhook_events` is the idempotency log so duplicate webhook
--     deliveries no-op. Stripe occasionally re-delivers; this prevents
--     double-emails and double-status-flips.

-- ── plans ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,
  name                     text NOT NULL,
  monthly_price_cents      integer NOT NULL,
  yearly_price_cents       integer NOT NULL,
  -- Stripe price ids may be null until you create them in the dashboard
  -- and update the row. The checkout route refuses to mint a session for
  -- a plan whose relevant price id is null, so partial setup is safe.
  stripe_monthly_price_id  text NULL,
  stripe_yearly_price_id   text NULL,
  -- Entitlement caps. NULL means "unlimited" (consumed by Phase D).
  seat_limit               integer NULL,
  proposal_limit           integer NULL,
  document_limit           integer NULL,
  review_limit             integer NULL,
  whiteboard_limit         integer NULL,
  meta_connection_limit    integer NULL,
  ai_daily_quota           integer NOT NULL DEFAULT 50,
  has_custom_domain        boolean NOT NULL DEFAULT false,
  features                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active                boolean NOT NULL DEFAULT true,
  is_public                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Seed the founder/beta plan. is_active=true so the checkout route picks
-- it up as the default. When standard pricing launches: insert a new row
-- and toggle is_active here. Update the stripe_*_price_id columns once the
-- prices exist in Stripe (or set them via env override — see lib/billing/stripe.ts).
INSERT INTO public.plans (slug, name, monthly_price_cents, yearly_price_cents, ai_daily_quota, features)
VALUES (
  'founders',
  'Founders',
  4900,
  49000,
  100,
  jsonb_build_object(
    'tagline', 'Founding-member pricing',
    'note', 'Locked in for life as long as your subscription stays active'
  )
)
ON CONFLICT (slug) DO NOTHING;

-- ── subscriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  company_id              uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES public.plans(id),
  stripe_customer_id      text NULL,
  stripe_subscription_id  text NULL UNIQUE,
  status                  text NOT NULL DEFAULT 'incomplete',
  billing_cycle           text NULL,
  trial_ends_at           timestamptz NULL,
  current_period_end      timestamptz NULL,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  canceled_at             timestamptz NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_billing_cycle_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_billing_cycle_check
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly'));

CREATE INDEX IF NOT EXISTS subscriptions_customer_idx
  ON public.subscriptions (stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ── stripe_webhook_events (idempotency log) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id      text PRIMARY KEY,
  event_type    text NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz NULL,
  payload       jsonb NOT NULL
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
