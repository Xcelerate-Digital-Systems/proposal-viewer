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
├── view/[token]/               # Public proposal viewer
├── doc/[token]/                # Public document viewer
├── review/[token]/             # Public review viewer
└── whiteboard/[token]/         # Public whiteboard viewer

components/
├── admin/                      # Authenticated UI (editors, forms, boards)
│   ├── proposals/              # Proposal editor
│   ├── reviews/                # Review management + board nodes
│   └── shared/                 # Cover, design, TOC, pricing editors
├── viewer/                     # Public viewer components
├── reviews/                    # Review detail view, comments, feedback tools
└── ui/                         # Primitives (Toast, ConfirmDialog)

hooks/                          # React hooks (auth, data fetching, feedback)
lib/
├── types/                      # All TypeScript type definitions
├── supabase.ts                 # Client-side Supabase + type re-exports
├── supabase-server.ts          # Server-side service client (bypasses RLS)
├── api-auth.ts                 # Auth context extraction for API routes
├── page-operations.ts          # CRUD barrel for page queries/mutations
├── notifications.ts            # Email + webhook notification orchestrator
└── sanitize.ts                 # Input validation, URL/email sanitization
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

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase public API key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role (server-only)
RESEND_API_KEY=                 # Resend email API key
NEXT_PUBLIC_APP_URL=            # App URL (http://localhost:3000 in dev)
```

## Plans

- [Creative Review completion plan](.claude/plans/proud-prancing-eclipse.md) — All 5 phases complete
