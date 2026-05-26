# CLAUDE.md — Proposal Viewer

## Quick Reference

```bash
npm run dev       # Dev server on localhost:3000
npm run build     # Production build (use to verify changes compile)
npm start         # Start production server
```

No test suite or linter configured. Use `npm run build` to catch TypeScript errors.

## Tech Stack

- **Framework**: Next.js 16.2 (App Router, webpack), React 19, TypeScript 5.4
- **Styling**: Tailwind CSS 3.4, lucide-react icons
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Email**: Resend
- **Key libs**: TipTap (rich text), @xyflow/react (whiteboard), @dnd-kit (drag-and-drop), react-pdf, pdf-lib, html2canvas

Build/dev scripts pin `--webpack` because the project's webpack config aliases `canvas: false` for pdf-lib/react-pdf SSR. Turbopack is the Next 16 default; migrating to it is a follow-up. `.npmrc` has `legacy-peer-deps=true` because `@emoji-mart/react@1.1.1` hasn't published a React-19-compatible peer-dep declaration — works at runtime, fix is to swap the package.

## Project Structure

```
app/                            # Next.js App Router pages + API routes
├── api/                        # ~50+ API routes
├── proposals/, documents/,     # Authenticated CRUD pages
│   templates/, reviews/
├── integrations/looker-studio/ # Connectors hub (Meta → Looker Studio)
├── view/[token]/               # Public proposal viewer
├── doc/[token]/                # Public document viewer
├── review/[token]/             # Public review viewer
└── whiteboard/[token]/         # Public whiteboard viewer

components/
├── admin/                      # Authenticated UI (editors, forms, boards)
│   ├── proposals/              # Proposal editor
│   ├── reviews/                # Review management + board nodes
│   ├── connectors/             # Integration cards + connection manager
│   └── shared/                 # Cover, design, TOC, quote editors
├── viewer/                     # Public viewer components
├── reviews/                    # Review detail view, comments, feedback tools
└── ui/                         # Primitives (Toast, ConfirmDialog)

hooks/                          # React hooks (auth, data fetching, feedback)
lib/
├── types/                      # All TypeScript type definitions
├── connectors/meta/            # Meta OAuth, token crypto, Insights API client
├── supabase.ts                 # Client-side Supabase + type re-exports
├── supabase-server.ts          # Server-side service client (bypasses RLS)
├── api-auth.ts                 # Auth context extraction for API routes
├── auth-fetch.ts               # Client-side fetch wrapper that injects the Supabase session as Bearer auth — use for any admin call to a getAuthContext-gated route
├── rate-limit.ts               # Postgres-backed sliding-window rate limiter (API mirrors @upstash/ratelimit so the impl is swappable)
├── page-operations.ts          # CRUD barrel for page queries/mutations
├── notifications.ts            # Email + webhook notification orchestrator
├── sanitize.ts                 # Input validation, URL/email sanitization
└── *-migration.sql             # Schema/policy migrations are checked into the repo alongside the code that depends on them (no central supabase/migrations dir)

apps-script/looker-connector/   # Google Apps Script community connector source
proxy.ts                        # Edge middleware (renamed from middleware.ts in Next 16)
```

## Architecture Patterns

### Data Access
- **Client-side**: `import { supabase } from '@/lib/supabase'` (anon key, respects RLS)
- **Server-side API routes**: `import { createServiceClient } from '@/lib/supabase-server'` (service role, bypasses RLS)
- Auth context in API routes: `getAuthContext(req)` from `lib/api-auth.ts`

### Auth
- Supabase Auth (email/password + magic links)
- Multi-tenant: company_id scoping throughout
- Super-admin role with company override support
- Public sharing via tokens (`share_token`, `board_share_token`)

### API Routes
- Pattern: validate auth → validate input → service client operation → return JSON
- Standard responses: `{ success, data }` or `{ error }` with appropriate status codes
- Routes that mutate proposals / documents / templates page rows: mirror the `ownsTemplate` / `ownsPage` helpers in [`app/api/templates/pages/route.ts`](../app/api/templates/pages/route.ts) — fetch the entity's `company_id` via service-role + `getAuthContext` and verify it matches `auth.companyId` before delegating to `lib/page-operations`. The proposal and document variants live in `app/api/proposals/pages/route.ts` and `app/api/documents/pages/route.ts`.

### Public-viewer mutations
Anon clients have NO INSERT/UPDATE on `proposals` or `proposal_views`. Anything the public proposal viewer needs to write goes through `POST /api/proposals/share/[token]/action` with `{ action: 'accept' | 'decline' | 'request_revision' | 'view', name?, reason?, notes? }`. The route authenticates by share_token in the URL + service-role writes. Hook callers: `hooks/useProposalActions.ts`, `hooks/useProposal.ts`.

### Rate limiting
`lib/rate-limit.ts` exposes `rateLimit({ key, limit, windowSeconds }) → { success, remaining, reset }` backed by a `rate_limits` table + atomic `check_rate_limit` RPC. Already wired into `/api/auth/{register,forgot-password,claim-invite}` (5/min/IP), `/api/ai/generate-text` (10/min/company burst), `/api/notify` (10/min/share_token), `/api/proposals/share/[token]/action` (30/min/share_token). For new endpoints, key by IP for unauthenticated flows, by `auth.companyId` for authenticated flows, by share_token for public-token flows. Fail-open — rate limiting is defense in depth.

### AI usage quota
`/api/ai/generate-text` runs through `increment_ai_usage(p_company_id uuid)` RPC before each Anthropic call. The RPC UPSERTs the company's daily counter and returns the new count atomically; the route rejects with 429 above 50/day. Bump `AI_DAILY_QUOTA` in the route to change the cap (eventually swap for a per-tier `companies.ai_daily_quota` column).

### Component Conventions
- Admin pages use `AdminLayout` wrapper with `(auth) => ...` render prop
- Public viewers load data via API routes using share tokens
- Import alias: `@/*` resolves to project root

### Review System (Creative Review Tool)
- **Two consumer paths**: admin (authenticated, direct Supabase) and client (public, API routes with token auth)
- **Content types**: webpage, email, ad, image, video, sms, google_ad, pdf
- **Feedback tools**: pin comments (always active), drawing annotations (arrow/box/text), text highlighting (email/SMS), auto-screenshot on pin, file attachments, emoji reactions
- **Whiteboard**: React Flow board with typed nodes per content type
- Pin coordinates stored as percentages (pin_x%, pin_y%) for responsive scaling
- Annotations stored as JSON in `annotation_data` column
- SVG-based drawing overlay with viewBox="0 0 100 100"
- Types in `lib/types/review.ts`, main view in `components/reviews/ReviewDetailView.tsx`

### Looker Studio Connector (Meta Ads)
- **UI hub**: `/integrations/looker-studio` — generic connector cards, plus a Meta-specific panel (setup instructions with the deployment ID, connected Meta account list with disconnect). Each connector ships its own panel because each community connector has a distinct deployment ID.
- **Scope**: connections are company-scoped, not user-scoped. A single company can have multiple Meta connections (unique on `(company_id, meta_user_id)`), so employees each authorize their own Meta login and coexist
- **Storage**: `meta_connections` (encrypted access token, status, last_used_at), `meta_ad_accounts` (one row per ad account exposed by the connection), `meta_oauth_states` (short-lived CSRF)
- **Passthrough**: no insights data is stored — every `/api/connectors/meta/data` request hits Meta live (Looker Studio caches ~12h)
- **Token encryption**: AES-256-GCM via `lib/connectors/meta/token-crypto.ts`, key in `META_TOKEN_ENCRYPTION_KEY`
- **Apps Script consumer**: authenticates via AgencyViz API key (`av_live_...`), resolves to company via `api_keys` table — the Apps Script itself never handles Meta tokens
- **Adding Insights fields**: extend `ALLOWED_INSIGHT_FIELDS` in `lib/connectors/meta/fields.ts` and the matching `Schema.gs` entry in `apps-script/looker-connector/`
- **Adding creative fields** (ad copy, thumbnails, permalinks, CTAs): these are NOT on `/insights` — they're hydrated per-ad via `lib/connectors/meta/creatives.ts` using Meta's batch-get endpoint (`/?ids=ad1,ad2,...&fields=creative{...}`, 50/batch). Extend `ALLOWED_CREATIVE_FIELDS` + `normalizeAd()` + `Schema.gs > CREATIVE_DIMENSIONS`. Advantage+ ads store multiple text variants in `creative.asset_feed_spec`; we flatten to first + pipe-joined "_all" variants.
- **Adding breakdowns** (age / gender / country / placement / etc.): every breakdown in `Schema.gs > BREAKDOWN_DIMENSIONS` is registered as a field in the schema *unconditionally*. `getData()` inspects `request.fields` for any breakdown ids the user dragged into their chart and passes them as `breakdowns=a,b,c` to Meta. Breakdown values arrive in each row under a key matching the breakdown name (e.g. `row.age = "25-34"`). Allowlist in `fields.ts > ALLOWED_BREAKDOWNS` — extend both catalogs to add a new one. Meta rejects some combinations (e.g. hourly + demographic) with a 400; the error surfaces to Looker Studio verbatim.
- **Date rollup dimensions** (Month/Quarter/Year/Week/Day of week) are derived client-side in `Code.gs` via `computeDateRollup()` from the existing `date_start` — no API change needed. `DATE_ROLLUP_FIELD_IDS` in `Schema.gs` signals to `schemaIdToApiField` to fetch `date_start` when a rollup is requested.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase public API key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role (server-only)
RESEND_API_KEY=                   # Resend email API key
NEXT_PUBLIC_APP_URL=              # App URL (http://localhost:3000 in dev)

# Meta → Looker Studio connector
META_APP_ID=                              # Facebook app id (OAuth client)
META_APP_SECRET=                          # Facebook app secret (OAuth token exchange)
META_TOKEN_ENCRYPTION_KEY=                # base64-encoded 32-byte key for AES-256-GCM token crypto

# Per-connector Apps Script deployment ids shown on /integrations/looker-studio.
# Each connector is a separate Apps Script project with its own deployment lifecycle.
NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META=    # Meta Ads → Looker Studio connector
NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_GHL=     # GoHighLevel → Looker Studio connector
```

## Terminology

- **Quote** (not "Pricing") — all admin-facing labels use "Quote" for the line-item pricing page. Internal code identifiers and URL paths still use `pricing` for backwards compatibility.

## Gotchas

- **Postgres function `SET search_path = ''` breaks unqualified table refs.** Most of our SECURITY DEFINER functions reference public tables without a `public.` prefix (e.g. `is_super_admin()` does `FROM team_members`); an empty search_path makes those throw "relation does not exist" inside RLS policy evaluation, which surfaces as the user being silently denied everything. Always use `SET search_path = 'public'` — still satisfies the Supabase `function_search_path_mutable` lint (any explicit value clears it) and `pg_catalog` is always implicitly prepended.
- **Supabase auto-grants EXECUTE to `anon` and `authenticated` on every new public-schema function.** A bare `REVOKE EXECUTE ... FROM PUBLIC` does NOT remove those role-specific grants. Always pair it with explicit `REVOKE EXECUTE ... FROM anon, authenticated` for server-only helpers, then `GRANT EXECUTE ... TO service_role`. Verify with `SELECT array_agg(rolname) FROM pg_roles WHERE has_function_privilege(rolname, 'public.fn_name'::regproc, 'execute') AND rolname IN ('anon','authenticated','service_role')`.
- **Next 16 forbids sibling dynamic routes with different param names.** `app/api/proposals/[id]/...` and `app/api/proposals/[token]/...` can't coexist — boot fails with "You cannot use different slug names for the same dynamic path". Workaround: nest under a static segment (e.g. `app/api/proposals/share/[token]/...`).
- **Supabase Data Cache + `supabase-js`.** Next's fetch cache silently memoizes supabase-js GETs by URL. `supabase-server.ts` passes a no-store fetch wrapper to defeat this; if you write a new server-side Supabase client, copy that pattern or stale-empty results will haunt you.
