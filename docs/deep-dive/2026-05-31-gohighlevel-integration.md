# GoHighLevel Pipeline Sync Integration for AgencyViz

**Date:** 2026-05-31
**Status:** Research Complete / Ready for Implementation Planning

---

## 1. Executive Summary

AgencyViz should integrate with GoHighLevel (GHL) to automatically synchronize proposal and quote lifecycle events into GHL pipelines. When a proposal or quote transitions stages in AgencyViz (e.g., Sent, Viewed, Accepted, Declined), the system should find or create the contact in GHL via the upsert endpoint, create or update the corresponding opportunity, and move it to the mapped pipeline stage. The integration should use GHL's private integration token (static Bearer auth) for single-agency deployments, configure pipeline and stage mapping at the global Settings level with optional per-entity overrides, and process all sync operations asynchronously through a Postgres-backed job queue with retry logic. This approach mirrors the dominant pattern established by Proposify and PandaDoc while avoiding the complexity of OAuth marketplace apps or bidirectional sync.

---

## 2. Recommended Architecture

### High-Level Design

```
AgencyViz Stage Change
        |
        v
  API Route writes stage change to DB
        |
        v
  Enqueue sync job (ghl_sync_jobs table)
        |
        v
  Background worker (Vercel Cron or edge function)
        |
        +---> POST /contacts/upsert  (find or create contact)
        |         |
        |         v
        +---> POST /opportunities/upsert  (create or update opportunity)
        |         |
        |         v
        +---> PUT /opportunities/:id  (move to mapped stage)
        |
        v
  Store ghl_opportunity_id on proposal/quote row
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth method | Private integration token | No OAuth complexity, no GHL review, sufficient for single-agency use. Can upgrade to OAuth marketplace app later. |
| Sync direction | One-way push (AgencyViz to GHL) | Eliminates sync loops. GHL is the CRM of record; AgencyViz is the proposal tool. Bidirectional sync can be added later with source flags. |
| Config model | Global defaults + optional per-entity override | Covers 80% of agencies with global config. Multi-client agencies with different pipelines get per-proposal/quote overrides. |
| Processing model | Async job queue (Postgres table) | Never block the request/response cycle on external API calls. Provides retry, dead-letter, and rate-limit handling. |
| Contact resolution | GHL upsert endpoint | Single API call handles find-or-create. Email is the primary dedup key, matching GHL's native behavior. |

---

## 3. GoHighLevel API Integration Details

### Authentication

- **Base URL:** `https://services.leadconnectorhq.com`
- **Auth header:** `Authorization: Bearer <private_integration_token>`
- **Version header:** `Version: 2021-07-28` (required on all requests)
- **Token management:** Up to 5 tokens per agency or location level. Recommended rotation every 90 days with 7-day overlap. Scope-restricted to only the permissions needed (contacts, opportunities, pipelines).

### Rate Limits

| Limit | Value |
|---|---|
| Burst | 100 requests per 10 seconds |
| Daily | 200,000 requests per app per resource |

AgencyViz's expected volume (a few dozen stage changes per day per agency) is well within these limits. The job queue should still respect 429 responses by re-enqueuing with delay.

### Key Endpoints

**Contacts:**

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/contacts/upsert` | Find or create contact by email/phone. Returns `contactId`. Requires `locationId`. |
| `POST` | `/contacts/search` | Advanced contact search (for manual linking UI). |
| `POST` | `/contacts/` | Create contact directly (requires `locationId`). |

**Opportunities:**

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/opportunities/pipelines` | List all pipelines and their stages for a location. Used to populate the stage mapping UI. |
| `POST` | `/opportunities/upsert` | Find or create opportunity. |
| `POST` | `/opportunities/` | Create opportunity. Requires `name`, `pipelineId`, `pipelineStageId`, `locationId`, `contactId`. |
| `PUT` | `/opportunities/:id` | Update opportunity (move stage by changing `pipelineStageId`). |
| `GET` | `/opportunities/search` | Search opportunities (for manual linking or conflict detection). |

**Important constraint:** Pipelines and stages cannot be created via API. They must exist in GHL before AgencyViz can map to them. The UI must communicate this clearly.

### Required Scopes for Private Integration Token

- `contacts.readonly`, `contacts.write` (for upsert)
- `opportunities.readonly`, `opportunities.write` (for create/update)
- `locations.readonly` (for location context)

---

## 4. Stage Mapping Configuration UX

### Settings Page Layout

The GHL integration settings should live in the existing Settings page as a new section under the Connectors/Integrations tab. The layout follows the dominant pattern established by Proposify, PandaDoc, and other proposal tools.

**Structure:**

```
Settings > Integrations > GoHighLevel
├── Connection Section
│   ├── API Token input (masked, with test button)
│   ├── Location selector (populated after token validation)
│   └── Connection status indicator
├── Pipeline & Stage Mapping Section
│   ├── Pipeline dropdown (populated from GET /opportunities/pipelines)
│   ├── Stage mapping table
│   │   ├── Left column: AgencyViz stages (fixed, non-editable)
│   │   ├── Right column: GHL stage dropdown per row
│   │   └── Default: "Do nothing" for each unmapped stage
│   └── Save button
└── Sync Toggle
    └── Master enable/disable switch
```

### AgencyViz Stages to Map

**Proposals:**

| AgencyViz Stage | Description |
|---|---|
| Draft | Proposal created but not sent |
| Sent | Proposal shared with client |
| Viewed | Client opened the proposal |
| Accepted | Client accepted |
| Declined | Client declined |
| Revision Requested | Client requested changes |

**Quotes:**

| AgencyViz Stage | Description |
|---|---|
| Draft | Quote created but not sent |
| Sent | Quote shared with client |
| Viewed | Client opened the quote |
| Accepted | Client accepted |
| Declined | Client declined |

### UX Principles

1. **Pipeline selector comes first.** The user must select a GHL pipeline before stage mapping is available. Changing the pipeline resets the mapping.
2. **"Do nothing" is the default.** Every row defaults to no action. The agency opts in to each stage sync explicitly.
3. **Inline validation.** Warn if no stages are mapped (integration is enabled but does nothing). Warn if the selected pipeline has fewer stages than expected.
4. **Test connection button.** Validates the API token and populates the location/pipeline dropdowns. Shows a clear success/failure indicator.
5. **One-click enable/disable.** A master toggle that enables or disables all GHL sync without losing the mapping configuration.

### Per-Entity Override (Phase 2)

For multi-client agencies that use different GHL pipelines per client, add a small "GHL Override" section on individual proposal/quote settings:

- Dropdown: "Use default pipeline" (default) or select a different pipeline
- If overridden, show the same stage mapping table scoped to that entity
- Store override in the proposal/quote row, not a separate table

---

## 5. Contact & Opportunity Sync Flow

### Step-by-Step Flow (triggered on stage change)

```
1. STAGE CHANGE EVENT
   AgencyViz detects proposal/quote stage transition
   (e.g., "Sent" → "Viewed")

2. CHECK MAPPING
   Look up ghl_stage_mappings for this AgencyViz stage
   If mapped to "do nothing" → stop, no sync needed
   If no GHL connection configured → stop

3. RESOLVE CONTACT
   Extract recipient email from proposal/quote
   POST /contacts/upsert with:
     - locationId (from global config)
     - email (from proposal/quote recipient)
     - name, phone (if available)
   Response returns contactId
   Store ghl_contact_id on the client record if not already set

4. RESOLVE OPPORTUNITY
   Check if proposal/quote row has ghl_opportunity_id
   
   IF NO existing opportunity:
     POST /opportunities/ with:
       - name: "[Proposal/Quote] {title}"
       - pipelineId (from config)
       - pipelineStageId (from stage mapping)
       - locationId (from config)
       - contactId (from step 3)
       - monetaryValue (quote total, if available)
     Store returned id as ghl_opportunity_id on proposal/quote row
   
   IF existing opportunity:
     PUT /opportunities/{ghl_opportunity_id} with:
       - pipelineStageId (from stage mapping)
       - status: "open" (or "won"/"lost" for Accepted/Declined)

5. LOG RESULT
   Update ghl_sync_jobs row with success/failure status
   On failure: increment retry count, schedule next attempt
```

### Contact Dedup Strategy

- **Primary key:** email address (matches GHL's native dedup behavior)
- **Upsert behavior:** GHL's `/contacts/upsert` handles find-or-create in a single call. If a contact with the same email exists, it returns the existing contact and updates any provided fields.
- **Blank field handling:** Only send fields that have values. Do not send empty strings, as GHL may overwrite existing data with blanks.
- **Client record linking:** Store `ghl_contact_id` on the AgencyViz `clients` table row for the associated client company, so subsequent proposals/quotes for the same client reuse the contact.

### Opportunity Naming Convention

Default format: `[Type] Title` (e.g., `[Proposal] Website Redesign` or `[Quote] SEO Package`). This makes it easy to identify AgencyViz-originated opportunities in GHL.

---

## 6. Event-Driven Architecture

### Job Queue Design

Use a Postgres-backed job queue (consistent with AgencyViz's existing architecture, which already uses Postgres for rate limiting). This avoids adding new infrastructure dependencies.

```
ghl_sync_jobs table:
  id              UUID PRIMARY KEY
  company_id      UUID NOT NULL REFERENCES companies(id)
  entity_type     TEXT NOT NULL  -- 'proposal' | 'quote'
  entity_id       UUID NOT NULL  -- proposal or quote ID
  event_type      TEXT NOT NULL  -- 'stage_changed'
  from_stage      TEXT           -- previous stage
  to_stage        TEXT NOT NULL  -- new stage
  payload         JSONB          -- contact info, opportunity data
  status          TEXT NOT NULL DEFAULT 'pending'
                                -- 'pending' | 'processing' | 'completed' | 'failed' | 'dead'
  attempts        INT DEFAULT 0
  max_attempts    INT DEFAULT 5
  next_attempt_at TIMESTAMPTZ DEFAULT NOW()
  last_error      TEXT
  idempotency_key TEXT UNIQUE   -- "{entity_type}:{entity_id}:{to_stage}:{timestamp}"
  created_at      TIMESTAMPTZ DEFAULT NOW()
  completed_at    TIMESTAMPTZ
```

### Processing Strategy

**Worker:** A Vercel Cron job running every 30-60 seconds that:

1. Selects pending jobs where `next_attempt_at <= NOW()` and `status IN ('pending', 'failed')` and `attempts < max_attempts`
2. Sets status to `processing` (with row-level lock to prevent double-processing)
3. Executes the GHL API calls
4. On success: sets status to `completed`, stores `completed_at`
5. On failure: sets status to `failed`, increments `attempts`, calculates `next_attempt_at` with exponential backoff

**Exponential backoff schedule:**

| Attempt | Delay |
|---|---|
| 1 | 30 seconds |
| 2 | 2 minutes |
| 3 | 10 minutes |
| 4 | 1 hour |
| 5 | Dead letter (status = 'dead') |

Add jitter (random 0-20% of delay) to prevent thundering herd.

### Rate Limit Handling

- On HTTP 429 from GHL: re-enqueue with delay from `Retry-After` header (or 60 seconds default)
- Track per-Location ID rate state in memory during batch processing
- At 100 req/10s burst limit, even aggressive batch processing is unlikely to hit limits given expected volume

### Idempotency

- **Contact upsert:** Inherently idempotent (GHL deduplicates by email)
- **Opportunity create:** Use the idempotency key to prevent duplicate creation. Before creating, check if the proposal/quote already has a `ghl_opportunity_id`.
- **Stage move:** `PUT /opportunities/:id` with the same `pipelineStageId` is idempotent (no state change if already at that stage)
- **Job dedup:** The `idempotency_key` unique constraint on the jobs table prevents duplicate jobs for the same stage transition

### Error Handling

| Error | Response |
|---|---|
| 401 Unauthorized | Mark connection as invalid, pause sync, notify admin |
| 404 Contact/Opportunity not found | Clear stored ID, re-create on next attempt |
| 422 Validation error | Log error details, mark job as dead (likely config issue) |
| 429 Rate limited | Re-enqueue with delay |
| 5xx Server error | Standard retry with backoff |
| Network timeout | Standard retry with backoff |

---

## 7. Data Model Changes

### New Tables

```sql
-- Global GHL connection configuration (one per company)
CREATE TABLE ghl_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  api_token       TEXT NOT NULL,          -- encrypted with existing token-crypto pattern
  location_id     TEXT NOT NULL,          -- GHL Location ID
  pipeline_id     TEXT NOT NULL,          -- selected GHL Pipeline ID
  pipeline_name   TEXT,                   -- cached for display
  enabled         BOOLEAN DEFAULT false,
  token_valid     BOOLEAN DEFAULT true,   -- set false on 401, true on successful test
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stage mapping configuration
CREATE TABLE ghl_stage_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id   UUID NOT NULL REFERENCES ghl_connections(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,          -- 'proposal' | 'quote'
  agencyviz_stage TEXT NOT NULL,          -- e.g. 'sent', 'viewed', 'accepted'
  ghl_stage_id    TEXT,                   -- GHL Pipeline Stage ID (NULL = do nothing)
  ghl_stage_name  TEXT,                   -- cached for display
  ghl_status      TEXT,                   -- 'open' | 'won' | 'lost' | NULL
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, entity_type, agencyviz_stage)
);

-- Async sync job queue
CREATE TABLE ghl_sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'stage_changed',
  from_stage      TEXT,
  to_stage        TEXT NOT NULL,
  payload         JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INT DEFAULT 0,
  max_attempts    INT DEFAULT 5,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_error      TEXT,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Sync log for debugging and audit trail
CREATE TABLE ghl_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES ghl_sync_jobs(id),
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,          -- 'contact_upsert', 'opportunity_create', 'opportunity_update'
  ghl_endpoint    TEXT,
  request_payload JSONB,
  response_status INT,
  response_body   JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Column Additions to Existing Tables

```sql
-- On proposals table: store GHL opportunity reference
ALTER TABLE proposals
  ADD COLUMN ghl_opportunity_id TEXT,
  ADD COLUMN ghl_pipeline_id TEXT,        -- per-entity override (NULL = use global)
  ADD COLUMN ghl_last_synced_at TIMESTAMPTZ;

-- On quote tables (pricing/quotes): store GHL opportunity reference
ALTER TABLE pricing
  ADD COLUMN ghl_opportunity_id TEXT,
  ADD COLUMN ghl_pipeline_id TEXT,
  ADD COLUMN ghl_last_synced_at TIMESTAMPTZ;

-- On clients table: store GHL contact reference
ALTER TABLE clients
  ADD COLUMN ghl_contact_id TEXT,
  ADD COLUMN ghl_last_synced_at TIMESTAMPTZ;
```

### Indexes

```sql
CREATE INDEX idx_ghl_sync_jobs_pending
  ON ghl_sync_jobs (next_attempt_at)
  WHERE status IN ('pending', 'failed') AND attempts < max_attempts;

CREATE INDEX idx_ghl_sync_jobs_company
  ON ghl_sync_jobs (company_id, created_at DESC);

CREATE INDEX idx_ghl_sync_log_entity
  ON ghl_sync_log (entity_type, entity_id, created_at DESC);
```

### Token Encryption

Reuse the existing AES-256-GCM encryption pattern from `lib/connectors/meta/token-crypto.ts` for the GHL API token. Store encrypted, decrypt at sync time. Use the same `META_TOKEN_ENCRYPTION_KEY` (or introduce a dedicated `GHL_TOKEN_ENCRYPTION_KEY` if key isolation is preferred).

---

## 8. Implementation Phases

### Phase 1: Connection & Configuration (1-2 weeks)

**Goal:** Agency can connect GHL and configure stage mappings in Settings.

- Create `ghl_connections` and `ghl_stage_mappings` tables (migration)
- Build API routes:
  - `POST /api/settings/ghl/connect` (validate token, fetch locations)
  - `GET /api/settings/ghl/pipelines` (proxy to GHL pipelines endpoint)
  - `POST /api/settings/ghl/mappings` (save stage mapping config)
  - `GET /api/settings/ghl/status` (connection status)
- Build Settings UI:
  - Token input with test/validate button
  - Location selector dropdown
  - Pipeline selector dropdown
  - Stage mapping table (proposals + quotes)
  - Enable/disable toggle
- Token encryption using existing crypto pattern
- Add `GHL_TOKEN_ENCRYPTION_KEY` env var (or reuse existing)

### Phase 2: Contact & Opportunity Sync (1-2 weeks)

**Goal:** Stage changes in AgencyViz create/update GHL contacts and opportunities.

- Create `ghl_sync_jobs` and `ghl_sync_log` tables (migration)
- Add `ghl_opportunity_id`, `ghl_contact_id` columns to existing tables (migration)
- Build GHL API client library (`lib/connectors/ghl/`):
  - `client.ts` (authenticated fetch wrapper with version header)
  - `contacts.ts` (upsert, search)
  - `opportunities.ts` (create, update, search)
- Build job enqueue logic:
  - Hook into proposal stage change (share, view, accept, decline, revision request)
  - Hook into quote stage change (share, view, accept, decline)
  - Enqueue `ghl_sync_jobs` row with contact/opportunity payload
- Build job processor:
  - Vercel Cron endpoint (`/api/cron/ghl-sync`)
  - Dequeue, process, retry logic
  - Contact upsert -> opportunity create/update flow
  - Error handling and logging

### Phase 3: Monitoring & Reliability (1 week)

**Goal:** Visibility into sync status and robust error handling.

- Sync status indicator on proposal/quote detail pages (last synced, sync errors)
- Settings page: recent sync activity log (last 50 jobs with status)
- Manual retry button for failed jobs
- Alert/notification on persistent sync failures (e.g., invalid token)
- Dead letter queue visibility in admin
- Connection health check (periodic token validation)

### Phase 4: Per-Entity Overrides (Optional, 1 week)

**Goal:** Agencies with multiple pipelines can override the default per proposal/quote.

- Add pipeline override UI on proposal/quote settings
- Per-entity stage mapping (inherits global, allows override)
- Store override pipeline ID on proposal/quote row

### Phase 5: Marketplace App (Future)

**Goal:** Publish to GHL marketplace for broader distribution.

- Convert from private integration token to OAuth2 flow
- Build OAuth consent and callback endpoints
- GHL marketplace listing and review process
- Multi-agency support (agency-level auth with location-scoped tokens)

---

## 9. Open Questions

| # | Question | Impact | Suggested Resolution |
|---|---|---|---|
| 1 | Should the integration support multiple GHL locations per company? | Some agencies manage multiple GHL sub-accounts. Phase 1 assumes one location per AgencyViz company. | Start with single location. Add multi-location support in Phase 4 if demanded. |
| 2 | How should we handle GHL contacts that share an email? | GHL's "Allow Duplicate Contact" setting at Location level could create duplicates. | Use `/contacts/upsert` which respects GHL's dedup settings. Document that agencies should keep dedup enabled. |
| 3 | Should opportunity monetary value sync from quote totals? | Valuable for agencies tracking revenue in GHL pipelines. | Include in Phase 2. Send `monetaryValue` from quote total on opportunity create/update. |
| 4 | Should we support mapping to GHL opportunity statuses (open/won/lost/abandoned)? | GHL opportunities have both a pipeline stage and a status. "Accepted" maps naturally to "won", "Declined" to "lost". | Include in Phase 2. Add `ghl_status` column to stage mappings (default NULL = don't change status). |
| 5 | What happens when a proposal is re-sent after revision? | Stage could cycle back (Revision Requested -> Draft -> Sent). Should this move the opportunity backward in the pipeline? | Allow backward stage moves. The mapping table controls this -- if "Sent" is mapped, the opportunity moves regardless of direction. |
| 6 | Should we encrypt the GHL token with the existing Meta encryption key or a dedicated one? | Key isolation vs. operational simplicity. | Use the existing key. Both are internal service tokens with the same threat model. Introduce a dedicated key only if security review requires it. |
| 7 | How should we handle GHL API downtime? | Jobs will fail and retry, but extended outages could fill the queue. | Max 5 retries with exponential backoff covers ~1.5 hours. After that, jobs go to dead letter. Admin notification triggers on first dead-letter entry. |
| 8 | Should the Vercel Cron worker process jobs in batch or one-at-a-time? | Batch is more efficient but adds complexity. | Process up to 10 jobs per cron invocation. Each job is independent. This stays well within Vercel function timeout (60s) and GHL rate limits. |
| 9 | Do we need a "disconnect" flow that cleans up GHL references? | Agencies might want to disconnect GHL and reconnect later. | Disable the connection (toggle off) but preserve `ghl_opportunity_id` references. A full disconnect should clear the token but keep IDs for historical reference. |
| 10 | Should we support custom field mapping (AgencyViz fields -> GHL custom fields)? | Power users might want to push proposal metadata (value, client name, etc.) into GHL custom fields. | Defer to Phase 4+. Start with the fixed fields (name, email, monetary value, stage). |

---

## 10. Sources

### GoHighLevel API Documentation
- GoHighLevel API v2 Reference: https://highlevel.stoplight.io/docs/integrations
- GHL Private Integration Tokens: https://highlevel.stoplight.io/docs/integrations/a04191c0fabf9-authorization
- GHL Contacts API: https://highlevel.stoplight.io/docs/integrations/contacts
- GHL Opportunities API: https://highlevel.stoplight.io/docs/integrations/opportunities
- GHL Pipelines API: https://highlevel.stoplight.io/docs/integrations/opportunities/pipelines
- GHL Rate Limits: https://highlevel.stoplight.io/docs/integrations/rate-limits
- GHL Marketplace Developer Docs: https://marketplace.gohighlevel.com/developer

### Competitor & Industry References
- Proposify HubSpot Integration Docs: https://support.proposify.com/en/articles/hubspot-integration
- PandaDoc Salesforce Integration Docs: https://support.pandadoc.com/hc/en-us/articles/salesforce-integration
- PandaDoc HubSpot Integration Docs: https://support.pandadoc.com/hc/en-us/articles/hubspot-integration
- Qwilr CRM Integration Patterns: https://qwilr.com/integrations/
- HoneyBook API & Zapier Integrations: https://support.honeybook.com/integrations
- Ziflow Webhook Documentation: https://support.ziflow.io/en/articles/zibots
- Monday.com API Documentation: https://developer.monday.com/api-reference

### Architecture & Patterns
- Postgres-backed Job Queues (PGMQ): https://github.com/tembo-io/pgmq
- Exponential Backoff and Jitter (AWS Architecture Blog): https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- Idempotent API Design Patterns: https://stripe.com/docs/api/idempotent_requests
