# Deployment — AgencyViz

Draft based on a production readiness audit. This document reflects what was
verified in the codebase and infrastructure at time of writing — not aspirational
process. Sections marked `> ASSUMPTION:` are inferred, not confirmed, and should
be validated before being treated as fact.

## Overview

AgencyViz is a Next.js 16.2.6 (App Router, Turbopack) application deployed on
Vercel, backed by Supabase (Postgres + Auth + Storage + RLS). Production is
served at `app.agencyviz.io`. Deploys are triggered by pushing to the `main`
branch on GitHub — there is no separate CI pipeline and no staging environment.

## Infrastructure

| Component | Value |
|---|---|
| Hosting | Vercel |
| Vercel team | `team_6Eg5e64Lwoq2EseDV7NB5oQR` |
| Production URL | `https://app.agencyviz.io` |
| Database | Supabase project `lyiwnbezmtbwpipbmgqp` (ap-southeast-2) |
| Bundler | Turbopack (Next 16 default) |
| Source control | GitHub, `main` branch |

> ASSUMPTION: DNS for `app.agencyviz.io` and any custom domains configured
> through `/api/company/custom-domain` are managed via Vercel's domain system.
> Not independently verified — confirm registrar and DNS provider.

> ASSUMPTION: Vercel project is on a paid tier sufficient for cron jobs,
> custom domains at the volume customers configure, and function timeout needs.
> Not verified against the Vercel dashboard.

## Build & Deploy

**Local development:**
```bash
npm run dev     # localhost:3000
```

**Production build (verify before every commit/deploy):**
```bash
npm run build   # Turbopack, catches TypeScript errors — currently passes clean
npm start        # Serve the production build locally
```

**Deploy flow:**
1. Push (or merge) to `main` on GitHub.
2. Vercel's GitHub integration auto-builds and deploys — no manual trigger,
   no approval gate.
3. There is **no CI pipeline** (no `.github/workflows/`). `npm run build`
   passing locally is the only build verification step before a deploy ships.
4. There is **no test suite**. Nothing runs automated checks pre-merge or
   pre-deploy beyond what Vercel's own build does (type-check + build).

`next.config.js` sets `canvas: false` as a resolve alias in both
`turbopack.resolveAlias` and the legacy `webpack: (config) =>` block, so
`next build --webpack` remains available as an escape hatch if a Turbopack
build issue ever needs to be worked around.

> ASSUMPTION: Vercel preview deployments are generated automatically for
> pull requests (Vercel's default GitHub integration behavior) even though no
> workflow file drives this. Treat preview URLs as the closest thing to a
> staging environment today, but note they use whatever env vars are
> configured for the Preview environment in Vercel — verify those are set
> correctly and don't point at production Supabase/Stripe/Meta credentials.

## Environment Variables

Names and purpose only — values are never documented here or committed to
the repo.

### Core / Supabase
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side, anon access) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — respects RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, bypasses RLS — used in API routes via `lib/supabase-server.ts` |

### App
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Base app URL, used for link generation (proposal/doc/review links, emails) |

### Email
| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend transactional email API key |

### Billing (Stripe)
| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe server-side API key |
| `STRIPE_WEBHOOK_SECRET` | Verifies signatures on `/api/billing/webhook` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side publishable key |

### Analytics
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog product analytics |

### Signup Gate
| Variable | Purpose |
|---|---|
| `PUBLIC_SIGNUP_ENABLED` | Server-side flag gating self-serve signup (default `false`) |
| `NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED` | Client-side mirror of the above |
| `PUBLIC_SIGNUP_EMAIL_ALLOWLIST` | CSV of emails allowed to self-serve signup while gated (optional, for testing) |

### Meta → Looker Studio Connector
| Variable | Purpose |
|---|---|
| `META_APP_ID` | Facebook App ID for Meta OAuth |
| `META_APP_SECRET` | Facebook App secret |
| `META_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key (base64, 32 bytes) encrypting stored Meta access tokens. **DO NOT ROTATE** — rotating invalidates all stored tokens and breaks every connected customer's Looker Studio reports. |
| `NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META` | Deployment ID for the Meta Ads Looker Studio community connector |
| `NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_GHL` | Deployment ID for the GoHighLevel Looker Studio community connector |

### Cron
| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Shared secret Vercel Cron sends; routes in `app/api/cron/` compare it with `timingSafeEqual` before running |

### Monitoring
| Variable | Purpose |
|---|---|
| Sentry DSN(s) | Configured via `@sentry/nextjs` config files (client/server/edge) — exact env var name(s) depend on Sentry's Next.js integration convention (typically `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`) |

> ASSUMPTION: The exact Sentry env var names above were not directly confirmed
> against the Sentry config files in this pass — verify `sentry.client.config.*`,
> `sentry.server.config.*`, `sentry.edge.config.*` (or `instrumentation.ts`)
> for the literal variable names in use.

> ASSUMPTION: All variables above are set per-environment in Vercel
> (Production / Preview / Development) rather than shared globally. Not
> independently verified — worth auditing, since Preview builds sharing
> production Stripe/Meta/Supabase credentials would be a real risk.

## Database Migrations

- No central `supabase/migrations` directory. SQL migration files live in
  `/lib/` next to the code that depends on them (e.g.
  `lib/feedback/*-migration.sql`).
- Migrations are **applied manually** — there is no migration runner, no
  `supabase db push` automation in the deploy flow, and no tracking table
  confirming which migrations have run against production.
- Practical consequence: a deploy that assumes a new column/table exists can
  ship to production before the corresponding SQL has been run, causing
  runtime errors. Migration order relative to code deploy is a manual
  discipline, not an enforced one.

> ASSUMPTION: Migrations are applied by a human running SQL directly against
> the Supabase project (dashboard SQL editor or `psql`), immediately before or
> after the corresponding code deploy. No automated migration step was found
> in the build/deploy path.

## Cron Jobs

Four routes exist under `app/api/cron/` (e.g. `meta-api-health`). Each is
gated by comparing the request's `CRON_SECRET` header/param using
`timingSafeEqual` to prevent unauthenticated invocation and timing attacks.

> ASSUMPTION: Cron schedules are defined in a `vercel.json` `crons` array
> (Vercel's standard mechanism). Not independently confirmed in this pass —
> verify `vercel.json` for the actual schedule/frequency of each of the four
> jobs, and confirm all four are still referenced there (an orphaned route
> under `app/api/cron/` with no matching `vercel.json` entry silently never
> runs).

## Monitoring & Observability

**In place:**
- Sentry configured for client, server, and edge runtimes (`@sentry/nextjs`
  config files exist for all three).
- PostHog for product analytics (`NEXT_PUBLIC_POSTHOG_KEY`).

**Gaps:**
- **No dedicated health-check endpoint.** There is no `/api/health` (or
  equivalent) that checks Supabase connectivity, Stripe reachability, or
  basic app liveness. Nothing to point an uptime monitor at beyond "does the
  homepage 200."
- **No business-metric alerting.** Failed payments, broken notification
  delivery, cron job failures, etc. have no alerting layer — they'd only
  surface via Sentry if the error path actually reports there, or via a
  customer complaint.
- **Most catch blocks log to `console.error` only**, which is invisible to
  Sentry on Vercel (console output isn't automatically forwarded to Sentry
  unless explicitly captured via `Sentry.captureException`). This means a
  large share of caught errors across the API routes are currently
  unmonitored in practice, even though Sentry is nominally "configured."

## Rollback

There is **no documented or automated rollback strategy**.

In practice, Vercel retains prior deployments and allows promoting a previous
deployment to production via the Vercel dashboard or CLI (`vercel rollback` /
"Promote to Production" on an earlier deployment) — this is Vercel platform
behavior, not something specific to this app's config.

> ASSUMPTION: No custom rollback tooling, feature flags, or blue/green
> mechanism exists beyond Vercel's built-in deployment history. Database
> migrations are **not** reversible via any tooling here — a rollback of the
> app code does not roll back schema changes, so any migration applied
> alongside a bad deploy needs a manually written down-migration or manual
> fix. This is a real gap: code rollback and schema rollback are decoupled
> and neither is automated.

## Known Gaps

1. **No CI pipeline** — no `.github/workflows/`, so build verification before
   merge is manual (`npm run build` run locally, at the developer's
   discretion).
2. **No test suite** — no automated regression coverage; every change
   depends on manual QA and a clean `npm run build`.
3. **No staging environment** — no dedicated pre-production environment
   documented; Vercel preview deploys exist by platform default but are not
   formalized as a staging step in the process.
4. **No database migration tooling** — SQL applied manually, no migration
   history table, no enforced ordering relative to code deploys.
5. **No health check endpoint** — nothing for uptime monitoring to hit that
   validates real app health (DB connectivity, etc.).
6. **No rollback automation** — Vercel's deployment history is the only
   safety net; database changes are not covered by it at all.
7. **Console-only error logging in most catch blocks** — Sentry is
   configured but likely under-utilized; a meaningful share of production
   errors are probably not reaching it today.
8. **No business-metric alerting** — silent failures (notifications, cron
   jobs, payment webhooks) have no alerting path.

## Recommendations

Roughly in priority order — highest-leverage, lowest-effort first:

1. **Add a health-check endpoint** (`/api/health`) that pings Supabase and
   returns a simple JSON status. Point an uptime monitor (even a free one)
   at it. This is the single cheapest fix on this list.
2. **Audit `console.error` usage against Sentry capture.** Grep for
   `console.error` in `app/api/` and `lib/`, and route the ones that matter
   (payment failures, notification dispatch failures, auth errors) through
   `Sentry.captureException`. This closes the biggest "silent failure" gap
   without needing new infrastructure.
3. **Add a minimal CI check** — a GitHub Actions workflow that runs
   `npm run build` on every PR is a small addition and catches build
   breakage before merge rather than after deploy. Doesn't require a test
   suite to add value.
4. **Document the actual migration process** — even a short runbook (where
   the SQL lives, who runs it, in what order relative to deploy) reduces the
   risk of a code/schema mismatch reaching production. Consider whether
   `supabase db push` / a lightweight migration tracker is worth adopting
   given the project already uses Supabase CLI concepts elsewhere.
5. **Decide on a staging environment intentionally.** Either formalize
   Vercel preview deploys as the staging step (with their own Supabase
   project or schema, not shared with production) or stand up a dedicated
   staging Supabase project. Right now it's ambiguous whether preview
   deploys hit production data.
6. **Write down a rollback runbook**, even if it's just "Vercel dashboard →
   Deployments → Promote previous deployment" plus an explicit note that
   this does not undo migrations, so responders don't assume it does during
   an incident.
7. **Add alerting for the four cron jobs** (e.g. Sentry cron monitoring /
   check-ins, or a simple "did this run in the last N hours" check) so a
   silently-failing `meta-api-health` job doesn't go unnoticed.
