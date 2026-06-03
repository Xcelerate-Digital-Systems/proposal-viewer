-- Ad Copy Variations: shared, reusable copy sets for Meta Ads
-- Variations are campaign-scoped entities with their own identity.
-- Multiple Meta Ad items can link to the same variation via the junction table.
-- Comments stay on review_items but are aggregated across items that share a variation.

-- ──────────────────────────────────────────────────────────────────────
-- 1. ad_copy_variations — one row per reusable (headline, primary_text) pair
-- ──────────────────────────────────────────────────────────────────────

create table if not exists ad_copy_variations (
  id           uuid primary key default gen_random_uuid(),
  review_project_id uuid not null references review_projects(id) on delete cascade,
  company_id   uuid not null,
  label        text,
  headline     text not null default '',
  primary_text text not null default '',
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_ad_copy_variations_project
  on ad_copy_variations(review_project_id);

create index if not exists idx_ad_copy_variations_company
  on ad_copy_variations(company_id);

-- ──────────────────────────────────────────────────────────────────────
-- 2. review_item_ad_variations — many-to-many junction
-- ──────────────────────────────────────────────────────────────────────

create table if not exists review_item_ad_variations (
  id                    uuid primary key default gen_random_uuid(),
  review_item_id        uuid not null references review_items(id) on delete cascade,
  ad_copy_variation_id  uuid not null references ad_copy_variations(id) on delete cascade,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  unique(review_item_id, ad_copy_variation_id)
);

create index if not exists idx_riav_item
  on review_item_ad_variations(review_item_id);

create index if not exists idx_riav_variation
  on review_item_ad_variations(ad_copy_variation_id);

-- ──────────────────────────────────────────────────────────────────────
-- 3. RLS — service-role bypass; authenticated users scoped to company_id
-- ──────────────────────────────────────────────────────────────────────

alter table ad_copy_variations enable row level security;
alter table review_item_ad_variations enable row level security;

-- ad_copy_variations: team members can CRUD within their company
create policy "ad_copy_variations_select" on ad_copy_variations
  for select to authenticated
  using (company_id = (
    select company_id from team_members
    where user_id = auth.uid()
    limit 1
  ));

create policy "ad_copy_variations_insert" on ad_copy_variations
  for insert to authenticated
  with check (company_id = (
    select company_id from team_members
    where user_id = auth.uid()
    limit 1
  ));

create policy "ad_copy_variations_update" on ad_copy_variations
  for update to authenticated
  using (company_id = (
    select company_id from team_members
    where user_id = auth.uid()
    limit 1
  ));

create policy "ad_copy_variations_delete" on ad_copy_variations
  for delete to authenticated
  using (company_id = (
    select company_id from team_members
    where user_id = auth.uid()
    limit 1
  ));

-- review_item_ad_variations: authenticated users can manage via their items
create policy "riav_select" on review_item_ad_variations
  for select to authenticated
  using (exists (
    select 1 from review_items ri
    join team_members tm on tm.company_id = ri.company_id
    where ri.id = review_item_id
      and tm.user_id = auth.uid()
  ));

create policy "riav_insert" on review_item_ad_variations
  for insert to authenticated
  with check (exists (
    select 1 from review_items ri
    join team_members tm on tm.company_id = ri.company_id
    where ri.id = review_item_id
      and tm.user_id = auth.uid()
  ));

create policy "riav_delete" on review_item_ad_variations
  for delete to authenticated
  using (exists (
    select 1 from review_items ri
    join team_members tm on tm.company_id = ri.company_id
    where ri.id = review_item_id
      and tm.user_id = auth.uid()
  ));

-- Service role bypasses RLS (already the default for service_role,
-- but explicit grants ensure new functions work correctly).
grant all on ad_copy_variations to service_role;
grant all on review_item_ad_variations to service_role;
