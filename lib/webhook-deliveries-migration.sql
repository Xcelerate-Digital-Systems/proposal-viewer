-- Webhook delivery logging table.
-- Tracks every webhook dispatch attempt for debugging and audit purposes.
-- Run this migration against your Supabase project.

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  proposal_id uuid not null,
  request_body text not null,
  response_status integer not null default 0,
  success boolean not null default false,
  error_message text,
  attempts integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_endpoint
  on public.webhook_deliveries(webhook_endpoint_id);
create index if not exists idx_webhook_deliveries_company
  on public.webhook_deliveries(company_id);
create index if not exists idx_webhook_deliveries_created
  on public.webhook_deliveries(created_at desc);
create index if not exists idx_webhook_deliveries_success
  on public.webhook_deliveries(success);

alter table public.webhook_deliveries enable row level security;

-- Agencies can read their own delivery logs through authenticated queries.
create policy "Team members can view own company deliveries"
  on public.webhook_deliveries for select
  using (
    company_id in (
      select tm.company_id from public.team_members tm
      where tm.user_id = auth.uid()
    )
  );

-- Only service_role inserts (from the webhook dispatch code).
-- No anon/authenticated insert needed.
revoke insert, update, delete on public.webhook_deliveries from anon, authenticated;
grant insert on public.webhook_deliveries to service_role;
grant select on public.webhook_deliveries to authenticated;

-- Auto-prune old deliveries (keep 90 days).
-- Run as a Supabase cron or pg_cron job:
--   select cron.schedule('prune-webhook-deliveries', '0 3 * * *',
--     $$delete from public.webhook_deliveries where created_at < now() - interval '90 days'$$);
