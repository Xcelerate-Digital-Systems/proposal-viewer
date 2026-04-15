# CLAUDE.md — Proposal Viewer

## Quick Reference

```bash
npm run dev       # Dev server on localhost:3000
npm run build     # Production build (use to verify changes compile)
npm start         # Start production server
```

No test suite or linter configured. Use `npm run build` to catch TypeScript errors.

## Tech Stack

- **Framework**: Next.js 14.2 (App Router), React 18, TypeScript 5.4
- **Styling**: Tailwind CSS 3.4, lucide-react icons
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Email**: Resend
- **Key libs**: TipTap (rich text), @xyflow/react (whiteboard), @dnd-kit (drag-and-drop), react-pdf, pdf-lib, html2canvas

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
├── page-operations.ts          # CRUD barrel for page queries/mutations
├── notifications.ts            # Email + webhook notification orchestrator
└── sanitize.ts                 # Input validation, URL/email sanitization

apps-script/looker-connector/   # Google Apps Script community connector source
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

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase public API key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role (server-only)
RESEND_API_KEY=                   # Resend email API key
NEXT_PUBLIC_APP_URL=              # App URL (http://localhost:3000 in dev)

# Meta → Looker Studio connector
META_APP_ID=                      # Facebook app id (OAuth client)
META_APP_SECRET=                  # Facebook app secret (OAuth token exchange)
META_TOKEN_ENCRYPTION_KEY=        # base64-encoded 32-byte key for AES-256-GCM token crypto
NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID= # Apps Script deployment id shown on the connector hub
```

## Terminology

- **Quote** (not "Pricing") — all admin-facing labels use "Quote" for the line-item pricing page. Internal code identifiers and URL paths still use `pricing` for backwards compatibility.
