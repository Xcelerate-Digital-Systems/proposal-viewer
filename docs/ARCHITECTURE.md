# AgencyViz — Architecture

> Status: **DRAFT** — generated from a production readiness audit (2026-08-04). Verify against source before treating as ground truth; sections marked `> ASSUMPTION:` were not directly confirmed in the audit and need sign-off.

## Overview

AgencyViz ("The Agency Toolbox") is a B2B SaaS product that lets agencies collaborate with their clients across proposals, quotes, creative review, funnel planning, and ad swipe files. It is multi-tenant, company-scoped, and ships both an authenticated admin surface (desktop-only) and a set of public, token-scoped viewer surfaces for clients/guests who don't hold an account.

Production is deployed at `app.agencyviz.io`. Codebase package name is `agencyviz`.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.1 (App Router, Turbopack) |
| UI | React 19, TypeScript 5.4, Tailwind CSS 3.4 |
| Database / Auth / Storage | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Payments | Stripe 22.1 |
| Email | Resend 4.8 |
| Rich text | TipTap 3.21 |
| Whiteboard / node graphs | @xyflow/react 12.10 |
| Drag-and-drop | @dnd-kit |
| Motion | framer-motion |
| Analytics | PostHog |
| Error tracking | Sentry |
| Hosting | Vercel |

Codebase size: ~1,038 source files (`.ts`/`.tsx`/`.js`). **4 test files, GitHub Actions CI pipeline** — see [Known Structural Issues](#known-structural-issues).

## Deployment

- GitHub `main` → Vercel auto-deploy (per project CLAUDE.md).
- GitHub Actions CI pipeline runs against pushes/PRs (4 test files), in addition to `npm run build` as the documented manual verification step.

> ASSUMPTION: Preview deployments exist per-PR via Vercel's default GitHub integration, but this was not directly confirmed in the audit.

> ASSUMPTION: Environment variables (Supabase keys, Stripe keys, `META_TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, etc.) are managed via Vercel project settings rather than committed `.env` files, consistent with the project's stated security rules — not independently verified for this audit.

## Module Map

181 API routes under `app/api/`, grouped by trust level (see [Trust Boundaries](#trust-boundaries)):

- **~129 authenticated routes** — `getAuthContext`-gated. Cover campaigns, templates, proposals, documents, settings, company, team, billing, connectors, ads, support.
- **11 `review`/`review-widget` routes** — public, token-scoped (guest/client access to Campaigns review flow).
- **1 MCP route** — `app/api/mcp/[[...transport]]`, 2,162 lines, 75 tool handlers, own auth path via `getAuth` (distinct from `getAuthContext`).
- **6 OAuth routes** — `/oauth/*`, PKCE-based, for third-party OAuth2 clients (Zapier/Make-style integrations).
- **2 webhook routes** — signature-verified (Stripe billing webhook, Resend inbound webhook).
- **4 cron routes** — protected by `CRON_SECRET` (Vercel Cron; token refresh jobs per project docs).
- **3 pre-auth routes** — `register`, `forgot-password`, `claim-invite`.
- **Public viewers** — non-API pages: `review/[token]`, `doc/[token]`, `funnel/[token]`, `swipe/[token]`, `whiteboard/[token]`, `view/[token]`, plus a "handoff" surface.

Bounded contexts (user-facing sections — see project CLAUDE.md for the full DB/TS/URL naming-skew table):

1. **Pitch** — Proposals, Quotes/Quote Builder, Docs, Template Library
2. **Campaigns** — Assets, Kanban, Whiteboard, Comments (DB: `review_*`, TS: `Feedback*`, URL: `/campaigns`)
3. **Funnel Planner**
4. **Swipe Vault**
5. **Integrations** — Meta → Looker Studio connector
6. **Settings, Team, Clients, Billing**

## Data Access

Two Supabase client paths, chosen by execution context:

- **Client-side**: `import { supabase } from '@/lib/supabase'` — anon key, respects RLS.
- **Server-side (API routes)**: `import { createServiceClient } from '@/lib/supabase-server'` — service role key, **bypasses RLS**, wraps fetch with `cache: 'no-store'` to avoid Next's fetch-cache silently memoizing supabase-js GETs.
- **Auth context extraction**: `getAuthContext(req)` in `lib/api-auth.ts` — resolves user, `companyId`, role, `isSuperAdmin` from the Bearer token.
- **Client-side fetch helper**: `authFetch()` in `lib/auth-fetch.ts` — injects the Supabase session as a Bearer token on admin API calls.

Standard API route pattern: validate auth → validate input → service-client operation → return `{ success, data }` or `{ error }` JSON.

> ASSUMPTION: `getAuthContext` and `createServiceClient` are used consistently across all ~129 authenticated routes. The audit counted 180 files calling `createServiceClient()` (more than the route count), meaning service-role access also happens from lib/helper modules, not just route handlers directly — each such call site is independently responsible for its own authorization check (see TB-6 below).

## Auth & Multi-tenancy

- Supabase Auth (email/password + magic links).
- Every tenant-scoped table carries `company_id`.
- Roles: **Owner / Admin / Member** — permission matrix in `lib/permissions.ts`.
- **Super-admin**: `is_super_admin` flag on `team_members`, with company override via a `?company_id=` query param; the switcher UI lives at `/accounts`.
- Public sharing is token-based: `share_token`, `board_share_token`, and per-item tokens gate the public viewer routes.

## Trust Boundaries

| ID | Boundary | Notes |
|---|---|---|
| TB-1 | Browser → authenticated API routes | Bearer token via `getAuthContext`. Standard path for ~129 routes. |
| TB-2 | Public guest → token-scoped viewers | 21 `review-widget` routes; **share token is the sole gate** — no user account. |
| TB-3 | Stripe → billing webhook | Signature-verified (`/api/billing/webhook`). |
| TB-4 | Resend → inbound webhook | `webhooks/resend`, signature/verification path not detailed in audit inputs. |
| TB-5 | MCP clients → `mcp/[[...transport]]` | 75 tools, own auth (`getAuth`, distinct from `getAuthContext`), supports `companyIdOverride` for super-admin use. |
| TB-6 | 180 files calling `createServiceClient()` | Each **bypasses RLS entirely** and hand-rolls its own authorization check — no centralized enforcement at the data layer for this call path. This is the largest single trust surface in the app. |
| TB-7 | Anon → `proposals/share/[token]/action` | The **sole public mutation gate** — anon clients otherwise have no direct INSERT/UPDATE on proposals/views. |
| TB-8 | OAuth2 clients → `/oauth/*` | PKCE flow, allowlisted `redirect_uris` per registered client in `oauth_clients`. |

The practical implication of TB-6: because RLS is bypassed for service-role access, **every one of those 180 call sites is a manual security control**, not a database-enforced one. A missing or incorrect `company_id`/ownership check in any of them is a full tenant-isolation failure at that call site, and there is no fallback RLS policy to catch the mistake.

## Key Subsystems

### Campaigns (Markup/Feedback)

- Naming skew across three layers: DB tables `review_*`, TS types/dirs `Feedback*`/`feedback`, user-facing URL `/campaigns`.
- Two consumer paths: authenticated admin (direct Supabase) and public client (token-authed API routes).
- Kanban stages: `draft → internal_review → client_review → approved / revision_needed / rejected`, with per-stage assignees.
- Guest visibility is stage-filtered — guests only ever see `client_review`, `approved`, `rejected`; internal stages are invisible to them (`lib/feedback/visibility.ts`, `GUEST_VISIBLE_STAGES`).
- Notifications are stage-scoped and guest-filtered so internal-stage events never reach guests. Dispatched via `/api/review-notify`.

### Page System

- Shared page CRUD (`lib/page-operations.ts`) is the common backbone for proposals, documents, and templates. Routes that mutate page rows verify `company_id` ownership before delegating to it.

### Rate Limiting

- Postgres-backed sliding window: `rate_limits` table + atomic `check_rate_limit` RPC.
- Keyed by IP (unauthenticated), `companyId` (authenticated), or `share_token` (public).
- Fails open. Wired into auth, AI, notify, and proposal-action routes.

### AI Usage Quota

- `/api/ai/generate-text` enforces a plan-driven daily quota via the atomic `increment_ai_usage(p_company_id)` RPC, rejecting requests once `plans.ai_daily_quota` is exceeded.

> Note: per project CLAUDE.md, "AI text generation" here is an internal content-assist utility gated by plan quota — product messaging must not describe AgencyViz itself as having AI features.

### Notifications

- Central orchestrator: `lib/notifications.ts` (email + webhook dispatch).
- Public-viewer mutations never write directly — they go through `POST /api/proposals/share/[token]/action` with `{ action: 'accept' | 'decline' | 'request_revision' | 'view' }`, authenticated by `share_token` with service-role writes (this is TB-7).

## Known Structural Issues

1. **Limited automated test coverage across ~1,038 source files (4 test files), though a GitHub Actions CI pipeline now runs.** There is still no boundary/contract test coverage for most of the 181 API routes, the 75 MCP tools, or the trust-boundary logic described above. `npm run build` (TypeScript compile) remains the primary verification step, now run automatically in CI alongside the existing test files rather than only manually.
2. **180 RLS-bypassing call sites (TB-6) with no centralized authorization layer.** Each `createServiceClient()` usage is independently responsible for its own `company_id`/ownership check. This is a large, distributed attack surface for tenant-isolation bugs, and nothing in the stack (RLS, middleware, a shared guard) currently backstops a mistake at any one of these 180 sites.
3. **CI gate now exists, but coverage is still thin.** A GitHub Actions CI pipeline runs before `main` → Vercel auto-deploy, but with only 4 test files, a regressed auth check or an accidental RLS-bypassing query can still reach `app.agencyviz.io` without being caught by an automated test — CI currently backstops build/compile failures far more than logic regressions.
4. **Three-way naming skew in the Campaigns system** (DB `review_*` / TS `Feedback*` / URL `/campaigns`) is a maintainability risk more than a security one, but it raises the chance of a future contributor misreading intent (e.g. patching the wrong layer, or missing that `Feedback*` identifiers are load-bearing) — documented as a known, accepted trade-off in the project's own CLAUDE.md rather than something to "fix."
5. **MCP route auth path (`getAuth`) is separate from the standard `getAuthContext` path used elsewhere.** Two parallel auth implementations across the codebase (plus `companyIdOverride` for super-admin) increase the chance the two drift out of sync over time.

> ASSUMPTION: The above list reflects only what the audit's stated inputs surfaced (route/file counts, trust boundaries, test/CI counts). A full security-focused pass (secrets handling, RLS policy correctness table-by-table, dependency audit) was out of scope for this document and should be tracked separately (see `THREAT_MODEL.md` if/when produced).
