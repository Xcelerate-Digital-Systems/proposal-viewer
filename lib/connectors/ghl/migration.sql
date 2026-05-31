-- GoHighLevel pipeline sync integration.
--
-- Design:
--   * One-way async push: AgencyViz stage changes → GHL contacts + opportunities.
--   * Agency configures once in Settings with a private integration token.
--   * Token is encrypted app-side (AES-256-GCM) before storage.
--   * Sync jobs are processed by a Vercel Cron worker with retry/backoff.

-- ── Connection configuration (one per company) ─────────────────────────

CREATE TABLE IF NOT EXISTS ghl_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  api_token_encrypted TEXT NOT NULL,        -- AES-256-GCM; see lib/connectors/ghl/token-crypto.ts
  location_id     TEXT NOT NULL,            -- GHL Location (sub-account) ID
  location_name   TEXT,                     -- cached for display
  pipeline_id     TEXT NOT NULL,            -- selected GHL Pipeline ID
  pipeline_name   TEXT,                     -- cached for display
  workflow_id     TEXT,                     -- optional: GHL Workflow ID to trigger
  workflow_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_monetary_value BOOLEAN NOT NULL DEFAULT true,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  token_valid     BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Stage mapping (maps AgencyViz stages → GHL pipeline stage IDs) ─────

CREATE TABLE IF NOT EXISTS ghl_stage_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id   UUID NOT NULL REFERENCES ghl_connections(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('proposal', 'quote')),
  agencyviz_stage TEXT NOT NULL,            -- e.g. 'sent', 'viewed', 'accepted'
  ghl_stage_id    TEXT,                     -- GHL Pipeline Stage ID (NULL = do nothing)
  ghl_stage_name  TEXT,                     -- cached for display
  ghl_opp_status  TEXT CHECK (ghl_opp_status IN ('open', 'won', 'lost', 'abandoned')),
  trigger_workflow BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, entity_type, agencyviz_stage)
);

-- ── Async sync job queue ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ghl_sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('proposal', 'quote')),
  entity_id       UUID NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'stage_changed',
  from_stage      TEXT,
  to_stage        TEXT NOT NULL,
  payload         JSONB,                    -- contact info, opportunity data snapshot
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ghl_sync_jobs_pending
  ON ghl_sync_jobs (next_attempt_at)
  WHERE status IN ('pending', 'failed') AND attempts < 5;

CREATE INDEX IF NOT EXISTS idx_ghl_sync_jobs_company
  ON ghl_sync_jobs (company_id, created_at DESC);

-- ── Sync log (audit trail for debugging) ────────────────────────────────

CREATE TABLE IF NOT EXISTS ghl_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES ghl_sync_jobs(id) ON DELETE SET NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,             -- 'contact_upsert', 'opportunity_create', 'opportunity_update', 'workflow_trigger'
  ghl_endpoint    TEXT,
  request_summary JSONB,                     -- redacted request payload (no tokens)
  response_status INT,
  response_body   JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_entity
  ON ghl_sync_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_company
  ON ghl_sync_log (company_id, created_at DESC);

-- ── Column additions to proposals table (covers both proposals and quotes) ──

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS ghl_opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS ghl_last_synced_at TIMESTAMPTZ;
