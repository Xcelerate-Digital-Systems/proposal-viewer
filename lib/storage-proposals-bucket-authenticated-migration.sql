-- storage-proposals-bucket-authenticated-migration.sql
--
-- Locks the private `proposals` storage bucket down to the `authenticated`
-- role. Before this migration the live policies were (captured 2026-07-31
-- via `select * from pg_policies where schemaname='storage'`):
--
--   "Allow reading proposals"    SELECT  roles={public}  qual: bucket_id='proposals'
--   "Allow uploads to proposals" INSERT  roles={public}  check: bucket_id='proposals'
--   "Allow deleting proposals"   DELETE  roles={public}  qual: bucket_id='proposals'
--
-- i.e. anyone holding the public anon key (shipped to every browser) could
-- read, overwrite and delete ANY tenant's proposal files.
--
-- ⚠️ DEPLOY ORDER: the app must ship the accompanying code changes FIRST.
-- Three upload modals (UploadModal, DocumentUploadModal, TemplateUploadModal)
-- used to send the bare anon key as the storage Bearer; they now send the
-- user's session token. Applying this migration against the old client code
-- silently breaks new-proposal / new-document / new-template PDF uploads.
--
-- Scope note: these policies are bucket-level, not tenant-level. Storage
-- paths (proposals/, templates/, documents/, covers/, ...) carry no
-- company_id, so per-tenant storage RLS is impossible without a path
-- migration + backfill of every payload.file_path. Tenant isolation is
-- enforced at the app layer (ownsProposal/ownsPage checks, temp_path and
-- filePath prefix validation). This migration's job is to close the
-- unauthenticated hole. Server-side code uses the service role and is
-- unaffected.

drop policy if exists "Allow reading proposals" on storage.objects;
drop policy if exists "Allow uploads to proposals" on storage.objects;
drop policy if exists "Allow deleting proposals" on storage.objects;

create policy "Authenticated can read proposals bucket"
  on storage.objects for select to authenticated
  using (bucket_id = 'proposals');

create policy "Authenticated can upload to proposals bucket"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proposals');

-- x-upsert / upsert:true overwrites hit UPDATE when the object exists.
create policy "Authenticated can update proposals bucket"
  on storage.objects for update to authenticated
  using (bucket_id = 'proposals')
  with check (bucket_id = 'proposals');

create policy "Authenticated can delete from proposals bucket"
  on storage.objects for delete to authenticated
  using (bucket_id = 'proposals');
