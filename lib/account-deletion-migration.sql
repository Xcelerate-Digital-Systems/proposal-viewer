-- Soft-delete companies. The owner-only DELETE /api/company route sets
-- this timestamp + cancels the Stripe subscription. AuthGuard refuses
-- entry to any company with deleted_at set, signing the user out.
--
-- Hard purge of the row + cascade is intentionally deferred to a manual
-- (or future cron) job so we keep ~30 days of recovery window for
-- accidental deletes and to satisfy any post-cancellation billing
-- reconciliation Stripe might need.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS companies_deleted_at_idx
  ON public.companies (deleted_at)
  WHERE deleted_at IS NOT NULL;
