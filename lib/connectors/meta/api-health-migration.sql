-- Integration health check table for tracking API version status.
-- Used by /api/cron/meta-api-health to detect deprecations and new versions.

create table if not exists integration_health (
  id uuid primary key default gen_random_uuid(),
  connector text not null,
  pinned_version text not null,
  latest_version text,
  status text not null check (status in ('healthy', 'upgrade_available', 'deprecated', 'error')),
  details jsonb not null default '{}',
  checked_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint uq_integration_health_connector unique (connector)
);

alter table integration_health enable row level security;

-- Service-role only — no client access needed.
revoke all on integration_health from anon, authenticated;
grant all on integration_health to service_role;
