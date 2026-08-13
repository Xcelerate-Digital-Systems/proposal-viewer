-- Migration: Fix company-assets storage policies for authenticated uploads.
--
-- The previous policies used `TO public` with `auth.role() = 'authenticated'`
-- checks, and the SELECT policy was dropped entirely (to prevent enumeration).
-- This caused INSERT to fail with RLS violations because Supabase Storage
-- needs a SELECT policy on the bucket for upload operations.
--
-- This aligns company-assets policies with the proposals bucket pattern:
-- all four CRUD policies scoped to the `authenticated` role directly.
-- Anonymous enumeration remains blocked (no policy for anon/public).

-- Drop old policies
DROP POLICY IF EXISTS "Company members can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Company members can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete assets" ON storage.objects;

-- SELECT (required for uploads to work)
CREATE POLICY "Authenticated can read company assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'company-assets');

-- INSERT
CREATE POLICY "Authenticated can upload to company assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-assets');

-- UPDATE
CREATE POLICY "Authenticated can update company assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-assets')
  WITH CHECK (bucket_id = 'company-assets');

-- DELETE
CREATE POLICY "Authenticated can delete from company assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-assets');
