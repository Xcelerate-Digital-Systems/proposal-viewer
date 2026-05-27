-- Schema additions for self-serve signup, onboarding gating, and per-user
-- tour completion tracking. Companion to the launch plan at
-- /Users/jackburton/.claude/plans/can-you-help-me-valiant-whisper.md.
--
-- Until PUBLIC_SIGNUP_ENABLED is flipped to true at the app layer, no
-- self-serve rows will be written. These columns are inert under invite-only
-- operation, so the migration is safe to apply ahead of the UI shipping.

-- companies.onboarding_completed_at — null until the new agency finishes
-- the /onboarding wizard. AuthGuard will use this to lock the app to the
-- wizard for self-serve signups. Existing rows default to now() so legacy
-- invite-created companies skip the wizard.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

UPDATE public.companies
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now())
WHERE onboarding_completed_at IS NULL;

-- companies.signup_source — how the agency entered the system. 'invite' is
-- the pre-self-serve default for everything created up to this point, plus
-- any future row created via the existing invite-claim flow. 'self_serve'
-- is set by /api/auth/register's no-invite branch. 'super_admin' is set by
-- /api/admin/accounts (the platform-owner create-account UI).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'invite';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_signup_source_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_signup_source_check
  CHECK (signup_source IN ('invite', 'self_serve', 'super_admin'));

-- team_members.tours_completed — per-user map of tour-id -> ISO timestamp.
-- React Joyride tours read this to decide whether to auto-launch on first
-- visit and write to it on completion. Per-user (not per-company) because
-- different teammates learn the surface at different times.
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS tours_completed jsonb NOT NULL DEFAULT '{}'::jsonb;
