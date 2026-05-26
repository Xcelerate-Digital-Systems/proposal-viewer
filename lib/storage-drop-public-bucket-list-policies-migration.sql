-- Drop broad SELECT policies on `storage.objects` for the two public buckets.
--
-- The buckets are configured public=true, so direct object URLs
-- (https://<project>.supabase.co/storage/v1/object/public/<bucket>/<key>)
-- continue to work *without* any RLS policy. The broad SELECT policies
-- below additionally allowed the LIST endpoint, letting anyone enumerate
-- every file in the bucket — which is what the Supabase auditor flagged.
--
-- After this migration:
--   * Public object URLs: still served (bucket public flag handles it)
--   * Listing via PostgREST: blocked
--   * Authenticated/service-role direct queries: blocked unless they have
--     another applicable policy (none of our app code lists these buckets)

DROP POLICY IF EXISTS "Public can read company assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read review screenshots" ON storage.objects;
