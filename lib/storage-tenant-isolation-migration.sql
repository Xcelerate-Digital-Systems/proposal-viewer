-- Storage Tenant Isolation Migration
--
-- Problem: current RLS on proposals + company-assets buckets only checks
-- `authenticated` role. Any logged-in user from ANY company can read/write
-- files in either bucket if they know (or guess) the path.
--
-- Fix: replace broad authenticated policies with function-based checks
-- that verify the caller belongs to a company (team_members lookup).
--
-- Limitation: the `proposals` bucket does NOT include company_id in file
-- paths (paths are like `covers/{proposalId}-{ts}.png`), so we can only
-- verify the user is a valid team member — not that they belong to the
-- specific company that owns the file. Full per-company isolation would
-- require migrating all existing file paths to include company_id as a
-- prefix. This migration is a meaningful improvement over the current
-- "any authenticated user" policy.
--
-- The `company-assets` bucket DOES include company_id in some paths
-- (e.g. `task-attachments/{companyId}/...`) but not all, so we apply
-- the same team_member check for consistency.
--
-- Run this in the Supabase SQL editor after verifying no policies
-- were added since the last migration.

-- ============================================================
-- Helper: is the current auth user a team member of any company?
-- ============================================================
CREATE OR REPLACE FUNCTION storage.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
  );
$$;

-- Restrict to service_role only (server-side calls bypass RLS anyway,
-- but this prevents anon/authenticated from calling the function directly
-- to probe team membership).
REVOKE EXECUTE ON FUNCTION storage.is_team_member() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION storage.is_team_member() TO service_role;

-- Actually, RLS policies run as the table owner (or SECURITY DEFINER context),
-- so the function needs to be callable within the policy evaluation context.
-- Supabase storage policies run under the authenticated role's context,
-- so we need authenticated to be able to execute this.
-- Corrected grants:
GRANT EXECUTE ON FUNCTION storage.is_team_member() TO authenticated;

-- ============================================================
-- PROPOSALS bucket — replace broad authenticated policies
-- ============================================================

-- Drop existing broad policies
DROP POLICY IF EXISTS "Authenticated can read proposals bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to proposals bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update proposals bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete from proposals bucket" ON storage.objects;

-- New policies: team members only
CREATE POLICY "Team members can read proposals bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proposals'
    AND storage.is_team_member()
  );

CREATE POLICY "Team members can upload to proposals bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proposals'
    AND storage.is_team_member()
  );

CREATE POLICY "Team members can update proposals bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'proposals'
    AND storage.is_team_member()
  )
  WITH CHECK (
    bucket_id = 'proposals'
    AND storage.is_team_member()
  );

CREATE POLICY "Team members can delete from proposals bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'proposals'
    AND storage.is_team_member()
  );

-- ============================================================
-- COMPANY-ASSETS bucket — replace broad authenticated policies
-- ============================================================

DROP POLICY IF EXISTS "Authenticated can read company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete from company assets" ON storage.objects;

CREATE POLICY "Team members can read company assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND storage.is_team_member()
  );

CREATE POLICY "Team members can upload to company assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND storage.is_team_member()
  );

CREATE POLICY "Team members can update company assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND storage.is_team_member()
  )
  WITH CHECK (
    bucket_id = 'company-assets'
    AND storage.is_team_member()
  );

CREATE POLICY "Team members can delete from company assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND storage.is_team_member()
  );
