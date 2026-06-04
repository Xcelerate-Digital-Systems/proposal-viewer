# CLAUDE.md — AgencyViz (proposal-viewer)

## Product Identity

AgencyViz ("The Agency Toolbox") is a B2B SaaS for agencies to work with their clients. The codebase is `proposal-viewer`; the product is branded **AgencyViz** at `app.agencyviz.io`.

**Hard rules:**
- There is **NO AI in the app** — never mention "AI writing assist" or "AI-assisted" anywhere in UI or copy.
- AgencyViz does **not do ad reporting** — frame integrations as "pipe Meta/GHL data into your Looker Studio reports", not "we report on ads".
- Admin surfaces are the agency's view. Client/public surfaces show the agency's branding, not AgencyViz branding.
- Admin is **desktop-only** by design. Mobile-responsive work is only for `/view/[token]` (proposals + quotes) and `/doc/[token]` (documents). All other public viewers (review, swipe, funnel, whiteboard) are NOT in mobile scope.

## Terminology

These are the current user-facing names. Internal code identifiers use older names for backwards compat — don't blanket-rename load-bearing identifiers.

| User-facing label | Old name(s) | Internal code / DB | URL path |
|---|---|---|---|
| **Pitch** (section) | Studio | — | — |
| Proposals | — | `proposals` | `/proposals` |
| Quotes / Quote Builder | Pricing | `pricing`, `quote_*` | `/quotes` |
| Docs | Documents | `documents` | `/documents` |
| Template Library | Templates | `templates`, `page_library` | `/templates` |
| **Campaigns** (section) | Projects → Markup → Feedback | `review_*` (DB), `Feedback*` (TS) | `/campaigns` |
| Assets | Items | `review_items`, `FeedbackItem` | `/campaigns/[id]/assets` |
| **Funnel Planner** | — | `funnel_*` | `/funnels` |
| **Swipe Vault** | Swipe File | `swipe_*` | `/ads` (sub-section) |
| **Integrations** | Connectors | `connectors`, `meta_*` | `/integrations`, `/settings/connectors` |
| **Quote** (page type) | Pricing | `pricing` in code/URLs | — |

**Three-way naming skew in the Campaigns system:**
- **DB tables**: `review_*` (`review_projects`, `review_items`, `review_comments`, etc.)
- **TS types / source dirs**: `feedback` (`components/feedback/`, `lib/types/feedback.ts`, `FeedbackProject`, `FeedbackItem`)
- **User-facing URLs + labels**: `campaigns` (`/campaigns`, `/campaigns/[id]/kanban`)

Legacy redirects in `next.config.js`: `/feedback` → `/markup` (permanent 301). The actual pages now live at `/campaigns`. The `/markup` intermediate path no longer exists as a route.

## Quick Reference

```bash
npm run dev       # Dev server on localhost:3000
npm run build     # Production build (catches TS errors)
npm start         # Start production server
```

No test suite or linter configured. Use `npm run build` to verify changes compile.

## Tech Stack

- **Framework**: Next.js 16.2.6 (App Router, Turbopack), React 19.2.6, TypeScript 5.4
- **Styling**: Tailwind CSS 3.4, lucide-react 0.400 icons
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Payments**: Stripe 22.1
- **Email**: Resend 4.8
- **Rich text**: TipTap 3.21 (color, highlight, link, mention, placeholder, text-align, underline extensions)
- **Whiteboard**: @xyflow/react 12.10
- **Drag-and-drop**: @dnd-kit (core 6.3, sortable 10.0, modifiers 9.0)
- **PDF**: react-pdf 9.1, pdf-lib 1.17
- **Other**: framer-motion 12.40, html2canvas 1.4, posthog-js 1.376, react-joyride 3.1 (onboarding tours), emoji-picker-react, roughjs (drawing annotations), tippy.js, openai (text generation), isomorphic-dompurify, @number-flow/react, geist font

Build uses Turbopack (Next 16 default). The `canvas: false` alias for pdf-lib/react-pdf SSR lives in both `turbopack.resolveAlias` and the legacy `webpack: (config) =>` block in `next.config.js`, so `next build --webpack` still works as an escape hatch.

## Project Structure

```
app/
├── api/                              # API routes (~45 route groups)
│   ├── admin/{accounts,join-as-member,metrics,support}
│   ├── ai/                           # AI text generation (Anthropic, quota-gated)
│   ├── auth/{register,login,forgot-password,claim-invite}
│   ├── billing/{checkout,entitlements,portal,subscription,webhook}
│   ├── campaigns/                    # Campaign (Markup) project CRUD
│   ├── clients/                      # Client company management
│   ├── company/{branding,custom-domain,settings,profile}
│   ├── connectors/meta/{oauth,accounts,data}
│   ├── cron/                         # Vercel Cron jobs (token refresh)
│   ├── documents/                    # Document CRUD + pages
│   ├── feedback/                     # Feedback items/comments API
│   ├── invites/{send,accept,list}
│   ├── line-item-templates/          # Reusable quote line items
│   ├── member-badge/                 # Team member badge/avatar
│   ├── notifications/{preferences,in-app}
│   ├── notify/                       # Proposal notification dispatch
│   ├── oauth/{authorize,approve,token,clients}
│   ├── onboarding/                   # Post-signup onboarding flow
│   ├── package-templates/            # Reusable quote packages
│   ├── page-library/                 # Template page library (community + custom)
│   ├── proposals/{[id],pages,share,split,mark-sent,member-info,page-urls}
│   ├── quotes/                       # Quote CRUD
│   ├── review/{[token]}/             # Public review viewer API
│   ├── review-comments/              # Review comment CRUD
│   ├── review-notify/                # Stage-scoped markup notification dispatch
│   ├── review-unsubscribe/           # Guest notification unsubscribe
│   ├── review-widget/                # Embeddable review widget API
│   ├── settings/{notifications,custom-domain}
│   ├── share-targets/                # Share recipient management
│   ├── support/                      # Support ticket submission
│   ├── team/{invite,remove,role}
│   ├── team-members/{badge,preferences}
│   ├── templates/{pages,merge,rebuild-merged,split,copy-data,section-headers}
│   ├── waitlist/                     # Pre-launch waitlist
│   └── webhooks/                     # Outbound webhook delivery
│
├── accounts/                         # Super-admin account switcher
├── ads/                              # Swipe Vault + naming convention
├── auth/                             # Auth callback handler
├── campaigns/                        # Campaigns (Markup) — list + project views
│   └── [id]/{kanban,board,assets,comments,setup,settings}
├── clients/                          # Client company management
├── company/                          # Company profile page
├── dashboard/                        # Main dashboard
├── doc/[token]/                      # Public document viewer
├── documents/                        # Document editor
├── funnels/                          # Funnel Planner
│   └── [id]/                         # Funnel editor
├── funnel/[token]/                   # Public funnel viewer
├── home/                             # Marketing homepage
├── integrations/                     # Connectors hub (Looker Studio)
├── login/                            # Login page
├── oauth/                            # OAuth consent + callback
├── onboarding/                       # Post-signup onboarding wizard
├── preview/                          # Template preview
├── pricing/                          # Public pricing page
├── proposals/                        # Proposal editor
│   └── [id]/                         # Proposal sub-pages
├── quotes/                           # Quote Builder editor
├── review/[token]/                   # Public review/markup viewer
├── settings/                         # Settings (single page, tabbed)
│   └── connectors/                   # Connector-specific settings
├── signup/                           # Self-serve signup (gated by flag)
├── support/                          # In-app support page
├── swipe/[token]/                    # Public swipe file viewer
├── team/                             # Team management page
├── template-preview/                 # Template preview renderer
├── templates/                        # Template Library
│   └── [id]/                         # Template editor
├── view/[token]/                     # Public proposal + quote viewer
├── whiteboard/[token]/               # Public whiteboard viewer
├── home/, pricing/, signup/,         # Marketing / SaaS pages
│   privacy-policy/, terms-and-conditions/
├── layout.tsx                        # Root layout
└── globals.css                       # Global styles + design tokens

components/
├── admin/                            # Authenticated UI
│   ├── AdminLayout.tsx               # Main layout wrapper with (auth) => render prop
│   ├── AdminSidebar.tsx              # Sidebar navigation
│   ├── builder-sections/             # Page editor section renderers
│   ├── company/                      # Company settings components
│   ├── connectors/                   # Integration cards
│   ├── dashboard/                    # Dashboard widgets (FeedbackActionWidgets)
│   ├── documents/                    # Document editor components
│   ├── feedback/                     # Campaigns admin components (kanban, board, etc.)
│   ├── funnels/                      # Funnel editor components
│   ├── page-editor/                  # Shared page editor (proposals/docs/templates)
│   ├── platform/                     # Platform-level UI (tours, badges)
│   ├── pricing/                      # Quote Builder components
│   ├── proposals/                    # Proposal editor components
│   ├── quotes/                       # Quote editor components
│   ├── settings/                     # Settings tabs (RolesTab, etc.)
│   ├── shared/                       # Shared editors (cover, design, TOC, quote)
│   ├── sidebar/                      # Sidebar config + sub-navigation
│   ├── templates/                    # Template Library components
│   └── text-editor/                  # TipTap editor wrapper
├── analytics/                        # PostHog analytics
├── auth/                             # Auth UI components
├── feedback/                         # Public review/markup viewer components
├── kanban/                           # Generic Kanban board components
├── marketing/                        # Marketing page components
├── support/                          # Support ticket components
├── tours/                            # Onboarding tour definitions
├── ui/                               # UI primitives (Toast, ConfirmDialog, Button)
└── viewer/                           # Public proposal/doc viewer components

hooks/
├── useAuth.ts                        # Auth state + company resolution
├── useEntitlements.ts                # Plan-based feature gating
├── useDocument.ts, useProposal.ts    # Entity data fetching
├── useProposalActions.ts             # Proposal mutations (accept/decline/etc.)
├── useItemVersions.ts                # Markup version management
├── usePinFeedback.ts                 # Pin comment interactions
├── useCommentFilters.ts              # Comment filtering
├── useCommentReactions.ts            # Emoji reactions
├── useGuestIdentity.ts               # Guest name/email for public viewers
├── useSwipeFiles.ts                  # Swipe vault data
├── useNotifications.ts               # In-app notification bell
├── useCompanyBranding.ts             # Company branding colors
├── useTemplatePreview.ts             # Template preview state
└── useTextHighlight.ts               # Text selection highlighting

lib/
├── types/                            # TypeScript type definitions
│   ├── feedback.ts                   # Campaign types (FeedbackProject, FeedbackItem, etc.)
│   ├── proposals.ts                  # Proposal types
│   ├── branding.ts                   # Branding/design types
│   ├── decision-extras.ts            # Item decision types (approve/reject)
│   ├── funnel.ts                     # Funnel types
│   ├── packages.ts                   # Quote package types
│   └── ...
├── billing/                          # Billing layer
│   ├── entitlements.ts               # Plan-driven resource gating
│   ├── plan.ts                       # Plan/subscription lookups
│   └── stripe.ts                     # Stripe client
├── feedback/                         # Campaign/Markup helpers
│   ├── participants.ts               # Guest/member participant resolution
│   ├── status.tsx                    # Status definitions + colors
│   ├── versions.ts                   # Version management
│   ├── visibility.ts                 # Guest visibility (GUEST_VISIBLE_STAGES)
│   ├── mention-html.ts              # @mention rendering
│   ├── persist-mentions.ts          # @mention persistence
│   ├── send-guest-invite.ts         # Guest invitation emails
│   ├── unsubscribe-token.ts         # Email unsubscribe tokens
│   └── *-migration.sql              # ~15 feedback-related migrations
├── connectors/meta/                  # Meta OAuth, token crypto, Insights API
├── supabase.ts                       # Client-side Supabase (anon key, respects RLS)
├── supabase-server.ts                # Server-side service client (bypasses RLS, no-store fetch)
├── api-auth.ts                       # Auth context extraction (getAuthContext)
├── auth-fetch.ts                     # Client-side fetch with Bearer auth injection
├── rate-limit.ts                     # Postgres-backed sliding-window rate limiter
├── permissions.ts                    # Role-based permission matrix (Owner/Admin/Member)
├── page-operations.ts                # Page CRUD barrel
├── page-mutations.ts                 # Page insert/update/delete/reorder
├── page-queries.ts                   # Page read queries
├── notifications.ts                  # Email + webhook notification orchestrator
├── notification-emails.ts            # Proposal notification email templates
├── notification-types.ts             # Notification event type registry
├── notification-webhooks.ts          # Outbound webhook dispatch
├── review-notification-emails.ts     # Markup notification email templates
├── in-app-notifications.ts           # In-app notification bell helpers
├── company-defaults.ts               # Default company settings
├── branding-defaults.ts              # Default branding config
├── sanitize.ts                       # Input validation, URL/email sanitization
├── proposal-url.ts                   # Proposal URL resolution (custom domains)
├── import-pages.ts                   # Page import between entities
├── split-proposal-pages.ts           # Split proposal into pages
├── public-signup.ts                  # Self-serve signup helpers
├── *-migration.sql                   # Schema/policy migrations (no central dir)
└── ...

apps-script/looker-connector/         # Google Apps Script community connector source
proxy.ts                              # Edge middleware (renamed from middleware.ts in Next 16)
```

## Architecture Patterns

### Data Access
- **Client-side**: `import { supabase } from '@/lib/supabase'` — anon key, respects RLS.
- **Server-side API routes**: `import { createServiceClient } from '@/lib/supabase-server'` — service role, bypasses RLS, `cache: 'no-store'` fetch wrapper.
- **Auth context**: `getAuthContext(req)` from `lib/api-auth.ts` — extracts user, companyId, role, isSuperAdmin from Bearer token.
- **Client-side fetch**: `authFetch()` from `lib/auth-fetch.ts` — injects Supabase session as Bearer auth for admin API calls.

### Auth & Multi-tenancy
- Supabase Auth (email/password + magic links).
- Multi-tenant: `company_id` scoping on all data tables.
- Roles: Owner / Admin / Member — permission matrix in `lib/permissions.ts`.
- Super-admin: `is_super_admin` on `team_members` with company override via `?company_id=` param.
- Super-admin account switcher at `/accounts`.
- Public sharing via tokens (`share_token`, `board_share_token`, per-item tokens).

### API Route Pattern
Validate auth → validate input → service client operation → return JSON. Standard responses: `{ success, data }` or `{ error }` with status codes. Routes that mutate page rows must verify `company_id` ownership before delegating to `lib/page-operations`.

### Public-Viewer Mutations
Anon clients have NO INSERT/UPDATE on proposals/views. Public writes go through `POST /api/proposals/share/[token]/action` with `{ action: 'accept' | 'decline' | 'request_revision' | 'view' }`. Authenticated by share_token + service-role writes.

### Rate Limiting
`lib/rate-limit.ts` — Postgres-backed sliding-window (`rate_limits` table + atomic `check_rate_limit` RPC). Key by IP (unauthenticated), `companyId` (authenticated), or `share_token` (public). Fail-open. Already wired into auth, AI, notify, and proposal action routes.

### AI Usage Quota
`/api/ai/generate-text` uses `increment_ai_usage(p_company_id)` RPC — atomic daily counter, rejects above quota (plan-driven via `plans.ai_daily_quota`).

### Campaigns (Markup/Feedback) System
- **Two consumer paths**: admin (authenticated, direct Supabase) and client (public, API routes with token auth).
- **Content types**: webpage, email, ad (with Meta ad copy variants), image, video, sms, google_ad, pdf.
- **Feedback tools**: pin comments (always active), drawing annotations (arrow/box/text/rough.js), text highlighting (email/SMS), auto-screenshot on pin, file attachments, emoji reactions.
- **Views**: Kanban board (default landing), React Flow whiteboard, asset list, comments list.
- **Kanban stages**: `draft` → `internal_review` → `client_review` → `approved` / `revision_needed` / `rejected`. Per-stage assignees (team members + guests).
- **Guest visibility**: guests only see items in `client_review`, `approved`, `rejected`. Comments are filtered by `stage_at_creation`. Internal stages are invisible to guests.
- **Per-reviewer approvals**: `review_item_decisions` table tracks individual approve/changes_requested votes per (item, stage, reviewer). Auto-advance when all stage-assigned reviewers approve.
- **Versioning**: items support multiple versions with upload + stage-reset. Per-version status history via `prior_status` column.
- **Notifications**: stage-scoped — team members filtered by their `stages` array, guests filtered by stages AND never receive internal-stage events. Dispatch via `/api/review-notify`. Email unsubscribe support.
- Pin coordinates stored as percentages (pin_x%, pin_y%). Annotations stored as JSON. SVG drawing overlay with viewBox="0 0 100 100".
- Types in `lib/types/feedback.ts`, main view in `components/feedback/ReviewDetailView.tsx`.
- Dashboard widgets: "Awaiting my review" + "Needs new version" cards on `/dashboard`.

### Template Library
- Page-level and package-level templates for reuse across proposals/documents.
- Page library (`/api/page-library`) with community and custom pages.
- Package templates (`/api/package-templates`) for reusable quote packages.
- Line-item templates (`/api/line-item-templates`) for reusable quote line items.

### Client Dashboard
- `/clients` — agency-side client company management.
- Client accounts can log in and see a filtered view (only `pitch` section visible in sidebar).

### Custom Domains
- Companies can set a custom domain for public-facing proposal/document URLs.
- Managed via `/api/company/custom-domain` and `CustomDomainManager` component.
- `lib/proposal-url.ts` resolves the correct URL based on custom domain config.

### Onboarding
- Post-signup wizard at `/onboarding` — company setup, branding, first-steps.
- Product tours via react-joyride (tour definitions in `components/tours/`).
- Gated behind `PUBLIC_SIGNUP_ENABLED` env flag.

### Settings Structure
Settings is a single tabbed page at `/settings/page.tsx`. Tabs include: General/Company, Members + Notifications (merged), Branding, Billing, API Keys, Custom Domain, Roles, Webhooks, Connectors. The `/settings/connectors` sub-route handles connector-specific settings.

## SaaS / Billing

### Pricing
Stripe-powered billing with plans defined in the `plans` table. Plan schema includes per-resource limits (seats, proposals, documents, reviews, meta connections), AI daily quota, and feature flags. Founders plan ships with unlimited resources except AI quota.

### Signup Gate
All public-signup surfaces are hard-gated behind `PUBLIC_SIGNUP_ENABLED` (server, default `false`) and `NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED`. Optional `PUBLIC_SIGNUP_EMAIL_ALLOWLIST=<csv>` for testing. Until flags flip, the app behaves as invite-only.

### Entitlements
`lib/billing/entitlements.ts` — plan-driven resource gating. Grandfathering: companies with `signup_source = 'invite'` and no subscription get unlimited access (pre-billing customers). Self-serve companies without a subscription are blocked. API routes use `checkResource(companyId, 'proposals')` before creating resources.

### Billing Routes
- `/api/billing/checkout` — Stripe Checkout session creation
- `/api/billing/portal` — Stripe Customer Portal
- `/api/billing/subscription` — Subscription status queries
- `/api/billing/entitlements` — Client-side entitlement checks
- `/api/billing/webhook` — Stripe webhook handler

## Looker Studio Connector (Meta Ads)

- **UI hub**: `/integrations` — connector cards. Meta-specific panel shows setup instructions + deployment ID + connected account list.
- **Scope**: company-scoped connections (unique on `company_id, meta_user_id`). Multiple Meta connections per company.
- **Storage**: `meta_connections` (encrypted access token), `meta_ad_accounts`, `meta_oauth_states`.
- **Passthrough**: no insights data stored — every `/api/connectors/meta/data` request hits Meta live (Looker Studio caches ~12h).
- **Token encryption**: AES-256-GCM via `lib/connectors/meta/token-crypto.ts`. Key in `META_TOKEN_ENCRYPTION_KEY` — DO NOT ROTATE.
- **Apps Script consumer**: authenticates via OAuth2 flow (not API-key paste), tokens are `av_live_*` rows in `api_keys`.
- **OAuth2**: clients registered in `oauth_clients` table. Endpoints at `/oauth/authorize`, `/api/oauth/{approve,token,clients/validate}`. Adding a new client (Zapier, Make) is just an INSERT — no code changes.
- **Adding fields**: extend `ALLOWED_INSIGHT_FIELDS` in `lib/connectors/meta/fields.ts` + matching `Schema.gs` entry.
- **Creative fields** (ad copy, thumbnails): hydrated per-ad via `lib/connectors/meta/creatives.ts` using Meta batch-get (50/batch). Advantage+ ads flatten to first + pipe-joined `_all` variants.
- **Breakdowns** (age/gender/country/placement): registered unconditionally in `Schema.gs > BREAKDOWN_DIMENSIONS`. `getData()` auto-passes `breakdowns=a,b,c` when those fields are dragged into a chart.
- **Date rollups** (Month/Quarter/Year/Week/Day of week): derived client-side in `Code.gs` from `date_start`.
- **Schema gotcha**: `IMAGE`/`HYPERLINK`/`IMAGE_LINK` FieldTypes are calculated-field-only in Looker Studio. Use `URL` type on raw schema fields.
- **Custom conversions**: deferred — not in current scope. See memory for implementation sketch.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=                      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=                 # Supabase public API key
SUPABASE_SERVICE_ROLE_KEY=                     # Supabase service role (server-only)
RESEND_API_KEY=                                # Resend email API key
NEXT_PUBLIC_APP_URL=                           # App URL (http://localhost:3000 in dev)
STRIPE_SECRET_KEY=                             # Stripe API key
STRIPE_WEBHOOK_SECRET=                         # Stripe webhook signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=            # Stripe publishable key
NEXT_PUBLIC_POSTHOG_KEY=                       # PostHog analytics key

# Signup gate
PUBLIC_SIGNUP_ENABLED=                         # Server flag (default false)
NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED=             # Client mirror
PUBLIC_SIGNUP_EMAIL_ALLOWLIST=                 # CSV of test emails (optional)

# Meta → Looker Studio connector
META_APP_ID=                                   # Facebook App ID (OAuth)
META_APP_SECRET=                               # Facebook App secret
META_TOKEN_ENCRYPTION_KEY=                     # AES-256-GCM key (base64, 32 bytes) — DO NOT ROTATE

# Looker Studio connector deployment IDs
NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META=         # Meta Ads connector
NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_GHL=          # GoHighLevel connector
```

## Gotchas

### Postgres & Supabase
- **`SET search_path = ''` breaks unqualified table refs.** SECURITY DEFINER functions reference public tables without `public.` prefix (e.g. `is_super_admin()` does `FROM team_members`). Empty search_path causes silent RLS denials. Always use `SET search_path = 'public'`.
- **Supabase auto-grants EXECUTE to `anon` and `authenticated` on new functions.** `REVOKE FROM PUBLIC` doesn't remove role-specific grants. Always: `REVOKE EXECUTE ... FROM anon, authenticated` then `GRANT EXECUTE ... TO service_role` for server-only helpers.
- **Supabase Data Cache + supabase-js.** Next's fetch cache silently memoizes supabase-js GETs by URL. `supabase-server.ts` passes a `cache: 'no-store'` fetch wrapper. If you write a new server-side Supabase client, copy that pattern. Quick diagnostic: if a query returns empty despite rows existing, change the `.select()` columns — if it works, it's the cache.

### Next.js
- **Next 16 forbids sibling dynamic routes with different param names.** `app/api/proposals/[id]/...` and `app/api/proposals/[token]/...` can't coexist — nest under a static segment (e.g. `app/api/proposals/share/[token]/...`).
- **Turbopack** is the default bundler. The `canvas: false` alias is configured for both Turbopack and webpack in `next.config.js`.

### UI / Components
- **@dnd-kit Kanban drag duplicates.** The sortable context can produce duplicate items during drag operations if `items` arrays aren't carefully keyed. Watch for this when modifying Kanban column rendering.
- **Pin/comment modal positioning.** Pin coordinates are stored as percentages. Modals must account for scroll offset and viewport boundaries when positioning relative to pins.
- **Cover page font inheritance.** Cover page components inherit Google Fonts from the proposal/document design settings. Font loading is async — ensure fonts are loaded before rendering cover previews or exports.
- **Design preview state sync.** Design settings (colors, fonts, layout) must sync across preview tabs and the live editor. Use the shared design context — don't cache design state independently in sub-components.
- **Button primitive.** New code should use `<Button>` from `@/components/ui/Button` (variants: primary/secondary/outline/ghost/danger/link, sizes: sm/md/lg) instead of inline `<button>` elements. Semantic color tokens: `primary`/`primary-hover`/`primary-tint` (#017C87 teal), `surface-dark` cluster (#043946) for sidebar/dark UI.

### Naming Skew
- The Campaigns system has three naming layers (DB: `review_*`, TS: `Feedback*`/`feedback`, URL: `/campaigns`). Don't blanket-rename — the in-code `Feedback*` identifiers are load-bearing across a huge surface area.
- Quote Builder code and URLs still use `pricing` internally. User-facing label is "Quote" / "Quote Builder".

## User Preferences

- **Be concise.** Don't over-explain. Get to the point.
- **Don't add extra features not asked for.** Build exactly what's requested, nothing more.
- **Don't break existing functionality.** When adding new features, verify existing behavior is preserved.
- **Check what exists before building new.** Read the code first — don't create duplicate components, hooks, or utilities when one already exists.
- **Use existing component patterns.** Follow established patterns in the codebase. Don't create new architectural patterns unless explicitly asked.
- **No marketing fluff or AI claims.** Product copy must be factual. No "AI-powered", no "intelligent", no "smart" — the app doesn't have AI features.
- **Implement the full thing.** Don't take shortcuts that trade UX for implementation ease. If building connector-parity features, deliver the full user-facing UX, not a config-panel shortcut.
- **Migrations go alongside code.** SQL migration files live in `/lib/` next to the code that depends on them — no central `supabase/migrations` directory.
- **Always open the browser tab.** After starting the dev server or making UI changes, run `open http://localhost:3000/<path>` to open the page in the browser so the user can see it immediately.

## Deprecated / Legacy

- **Ad Tracker** — removed 2026-05-16. UI + DB tables dropped. Git history before that date has old code. The Swipe Vault (`/ads`) and naming convention are separate features and remain.
- **Proposal comments** — planned for removal. Legacy feature replaced by the Campaigns system. Affects notifications, hooks, UI, and the `proposal_comments` table.
- **`/feedback` and `/markup` URL paths** — `/feedback` permanently redirects to `/markup` in `next.config.js`. Actual pages now live at `/campaigns`. The `/markup` intermediate path no longer exists as a route.
- **Meta custom conversions** — deferred from Looker connector scope (2026-04-16).

## Deploy

- GitHub `main` push → Vercel auto-deploy.
- Production: `https://app.agencyviz.io/`
- Supabase project: `lyiwnbezmtbwpipbmgqp` (ap-southeast-2)
- Vercel team: `team_6Eg5e64Lwoq2EseDV7NB5oQR`


## Mistake Log

Running list of mistakes and issues encountered during development. Before starting any task, scan this list to avoid repeating past errors. Add new entries as they occur with the date and a one-line description of what went wrong and the correct approach.

<!-- Format: - **YYYY-MM-DD** — What went wrong → What to do instead -->

