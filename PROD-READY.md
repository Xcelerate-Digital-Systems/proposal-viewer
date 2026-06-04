# Production Readiness Report — AgencyViz (Proposal Viewer)
Generated: 2026-05-27T12:00:00Z  |  Scope: Full codebase  |  Stack: Next.js 16 + Supabase + Resend + Vercel
**Last updated: 2026-05-27** — All code-level fixes applied. Build verified clean.

## Verdict
**APPLY-MIGRATION-THEN-SHIP** — All 3 Critical, 10 High, and 14/17 Medium issues have code-level fixes applied and build-verified. Remaining action: apply `lib/prod-ready-rls-migration.sql` to the production Supabase database (C1, C2) and verify M12 RLS state on live DB.

---

## Critical (blockers — fix before launch)

- [x] **C1: Funnel RLS policies are always-true — cross-tenant data leak** — `lib/prod-ready-rls-migration.sql`
  - What: Funnel table SELECT policies use `USING (share_token IS NOT NULL)`, but `share_token` has a `NOT NULL DEFAULT` constraint — the condition is always true, equivalent to `USING (true)`.
  - Why it matters: Any anon-key holder can dump all funnels across all tenants via the Supabase client, harvest share_tokens, and use `get_funnel_data()` to extract complete funnel data for every company.
  - Fix: Migration written to drop all five funnel public SELECT policies. **⚠ Must be applied to production DB.**
  - Detected by: vibe-security (database RLS audit)

- [x] **C2: Tables with RLS disabled — `api_keys`, `oauth_extension_codes`, `review_item_decisions`** — `lib/prod-ready-rls-migration.sql`
  - What: These tables have `ROW LEVEL SECURITY` never enabled. `oauth_extension_codes` stores `plaintext_token` for unconsumed authorization codes.
  - Why it matters: Any authenticated user from any tenant can read all API keys, steal unconsumed OAuth authorization codes, and access reviewer PII (emails, names) from `review_item_decisions`.
  - Fix: Migration written to enable RLS with deny-all (service-role-only access). **⚠ Must be applied to production DB.**
  - Detected by: vibe-security (database RLS audit)

- [x] **C3: SSRF in import-from-url — no private IP filtering** — `app/api/ads/swipe/files/import-from-url/route.ts`
  - What: `downloadAndStore()` fetched arbitrary user-supplied URLs with zero SSRF protection.
  - Fix applied: `isValidWebhookUrl()` check on both `media_src_url` and `thumbnail_src_url` before fetch, plus defense-in-depth inside `downloadAndStore`, plus `redirect: 'manual'`.
  - Detected by: vibe-security (rate-limit/AI audit, deployment audit)

---

## High (fix within 2 weeks of launch)

- [x] **H1: Reactions endpoint has zero authentication** — `app/api/review-comments/[id]/reactions/route.ts`
  - Fix applied: Dual auth — `getAuthContext` for admin path (Authorization header), share_token validation for public path. Verifies comment belongs to caller's company or share_token's project.
  - Detected by: vibe-security (database RLS, auth, deployment audits)

- [x] **H2: Video upload accepts unvalidated `company_id` — unauthenticated upload** — `app/api/review-comments/video-upload/route.ts`
  - Fix applied: `getAuthContext(req)` required when `company_id` form field is provided. Verifies `companyIdRaw === auth.companyId` (super_admin bypass preserved).
  - Detected by: vibe-security (database RLS, auth, deployment audits)

- [x] **H3: Member badge endpoint allows arbitrary storage reads** — `app/api/member-badge/route.ts`
  - Fix applied: `ALLOWED_PREFIXES = ['avatars/', 'company-logos/']` validation, path normalization, `..` traversal rejection.
  - Detected by: vibe-security (database RLS, deployment audits)

- [x] **H4: `/api/proposals/page-urls` and `/api/documents/page-urls` accept `entity_id` without auth** — both routes
  - Fix applied: `getAuthContext(req)` required when `entity_id` is provided. Verifies entity belongs to `auth.companyId`.
  - Detected by: vibe-security (database RLS, auth audits)

- [x] **H5: IP spoofing bypasses all IP-based rate limits** — `lib/rate-limit.ts`
  - Fix applied: `ipFromRequest()` now prefers `x-real-ip` (Vercel non-spoofable), falls back to rightmost `X-Forwarded-For` entry.
  - Detected by: vibe-security (rate-limit audit)

- [x] **H6: No rate limit on OpenAI Whisper transcription** — `app/api/ads/swipe/files/[id]/transcribe/route.ts`
  - Fix applied: 5/min/company burst rate limit.
  - Detected by: vibe-security (rate-limit/AI audit)

- [x] **H7: Invite email URL uses attacker-controlled Origin header** — `app/api/invites/route.ts`, `app/api/invites/[id]/route.ts`
  - Fix applied: Replaced `req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL` with `process.env.NEXT_PUBLIC_APP_URL || ''`.
  - Detected by: vibe-security (rate-limit/AI audit)

- [x] **H8: No rate limit on OAuth token exchange** — `app/api/oauth/token/route.ts`, `app/api/oauth/extension/exchange/route.ts`
  - Fix applied: 10/min/IP rate limit on both endpoints.
  - Detected by: vibe-security (rate-limit audit)

- [x] **H9: Rate limiter fails open on DB error** — `lib/rate-limit.ts`
  - Fix applied: `failClosed` option added. Auth endpoints (register, forgot-password, claim-invite) pass `failClosed: true`.
  - Detected by: insecure-defaults audit

- [x] **H10: No security response headers** — `next.config.js`
  - Fix applied: `headers()` block returning X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, HSTS, Permissions-Policy. CSP intentionally deferred (needs TipTap/widget config).
  - Detected by: vibe-security (deployment audit, secrets/env audit)

---

## Medium (track in backlog)

- [x] **M1: Webhook dispatch follows redirects — redirect-based SSRF** — `lib/notification-webhooks.ts`, `app/api/review-notify/route.ts`, `app/api/webhooks/test/route.ts`
  - Fix applied: `redirect: 'manual'` on all webhook fetch calls.
  - Detected by: static-analysis audit

- [x] **M2: Open redirect in review viewer `?back=` parameter** — `app/review/[token]/page.tsx`
  - Fix applied: Removed `isValidHttpUrl(urlBack)` branch. Only `isSafeBackPath` (relative paths starting with `/`, not `//`) allowed.
  - Detected by: static-analysis audit

- [ ] **M3: File upload endpoints (5 routes) have no rate limiting** — multiple routes
  - What: None of these upload routes have rate limits. The review-comments endpoints accept public share tokens.
  - Fix: Add per-token/per-company rate limits (20-30/min). Not yet applied.
  - Detected by: vibe-security (rate-limit audit)

- [x] **M4: Invite send/resend has no rate limiting — email flood** — `app/api/invites/route.ts`, `app/api/invites/[id]/route.ts`
  - Fix applied: 10/min/company for invite create, 5/min/company for resend.
  - Detected by: vibe-security (rate-limit audit)

- [x] **M5: Public review widget comments/reactions have no rate limiting** — widget comment/reaction routes
  - Fix applied: 30/min/token for comments, 60/min/token for reactions.
  - Detected by: vibe-security (rate-limit audit)

- [x] **M6: Webhook test endpoint — no rate limit** — `app/api/webhooks/test/route.ts`
  - Fix applied: 5/min/company rate limit + `redirect: 'manual'`.
  - Detected by: vibe-security (rate-limit audit)

- [x] **M7: Meta connector data proxy has no rate limit** — `app/api/connectors/meta/data/route.ts`
  - Fix applied: 30/min/company rate limit.
  - Detected by: vibe-security (rate-limit audit)

- [x] **M8: Cron flush fails open without CRON_SECRET** — `app/api/cron/flush-review-notifications/route.ts`
  - Fix applied: Changed `if (!secret) return true` to `if (!secret) return false` (fail-closed).
  - Detected by: vibe-security (auth audit, deployment audit)

- [x] **M9: Swipe upload cross-company path injection** — `app/api/ads/swipe/files/upload/route.ts`
  - Fix applied: Replaced client-supplied `company_id` with `auth.companyId` in storage path. Extension sanitized to alphanumeric only.
  - Detected by: vibe-security (deployment audit)

- [x] **M10: Transcribe route follows stored URL without redirect protection** — `app/api/ads/swipe/files/[id]/transcribe/route.ts`
  - Fix applied: `redirect: 'manual'` on `fetch(file.media_url)`.
  - Detected by: vibe-security (deployment audit)

- [x] **M11: `review_item_decisions` leaks reviewer PII** — covered by C2 fix
  - Fix applied: Covered by C2 migration (enable RLS with deny-all).
  - Detected by: vibe-security (database RLS audit)

- [ ] **M12: `swipe_types` and `swipe_files` may lack RLS in production** — original migration
  - What: The original migration never enables RLS. **⚠ Verify on live DB.**
  - Fix: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` if missing.
  - Detected by: vibe-security (database RLS audit)

- [x] **M13: Service role client created inline (stale cache risk)** — widget screenshot/script/heartbeat routes
  - Fix applied: All three routes now use `import { createServiceClient } from '@/lib/supabase-server'` with `const supabase = createServiceClient()` inside the handler.
  - Detected by: vibe-security (secrets/env audit)

- [x] **M14: `Math.random()` used for storage paths and IDs** — register, screenshot, packages
  - Fix applied: `crypto.randomBytes()` in register slug suffix, `crypto.randomUUID()` in screenshot filename and package line item IDs.
  - Detected by: vibe-security (secrets/env audit), sharp-edges audit

- [x] **M15: Unguarded `await req.json()` — server crash on malformed input** — assignees, guests, clients, admin accounts routes
  - Fix applied: All four routes now wrap `await req.json()` in try/catch, returning 400 on SyntaxError.
  - Detected by: sharp-edges audit

- [x] **M16: TOCTOU race condition in slug uniqueness checks** — `app/api/clients/route.ts`, `app/api/admin/accounts/route.ts`
  - Fix applied: Direct INSERT + catch constraint violation `error.code === '23505'` → 409.
  - Detected by: sharp-edges audit

- [ ] **M17: `html2canvas` unmaintained (3.5+ years, no active maintainer)** — `package.json`
  - What: Used in production for screenshot capture. If a DOM parsing vulnerability is found, there will be no patch.
  - Fix: Evaluate migration to `html-to-image` or `modern-screenshot` (actively maintained alternatives). Not yet applied.
  - Detected by: supply-chain audit

---

## Low

- [ ] **L1: Invite validation endpoint has no rate limit** — `app/api/invites/validate/route.ts:8`
  - UUID search space makes enumeration impractical. Add rate limit if concerned.
  - Detected by: vibe-security (rate-limit audit)

- [ ] **L2: AI output not HTML-sanitized before return** — `app/api/ai/generate-text/route.ts:269-278`
  - Text returned directly. Risk only if rendered as HTML downstream. Rendering layer should always escape.
  - Detected by: vibe-security (rate-limit/AI audit)

- [ ] **L3: DEBUG_OAUTH may log sensitive data** — `app/api/oauth/token/route.ts:18-19`
  - Guarded by env var, but could be left on accidentally in production.
  - Detected by: vibe-security (secrets/env audit, deployment audit)

- [ ] **L4: Screenshot upload MIME type handling** — `app/api/review-widget/[token]/screenshot/route.ts:68,90`
  - `\w+` regex rejects SVG (good) but ext derivation only handles jpeg→jpg, defaults to png.
  - Detected by: vibe-security (deployment audit)

- [ ] **L5: Postgres error messages leaked to clients** — 40+ API routes (e.g., `app/api/ads/swipe/types/route.ts:34`, `app/api/clients/route.ts:61`, `app/api/settings/api-keys/route.ts:62`)
  - Pattern: `if (error) return NextResponse.json({ error: error.message }, { status: 500 })` — leaks table names, column names, constraint names, PostgreSQL version info.
  - Fix: Return generic "Internal server error" to client, log detailed error server-side.
  - Detected by: insecure-defaults audit

- [ ] **L6: Company branding endpoint enables company enumeration** — `app/api/company/branding/route.ts:6-20`
  - Unauthenticated, no rate limit. Returns company name, slug, website, and branding config for any `company_id` UUID.
  - Fix: Require a share_token that maps to the company, or add rate limiting.
  - Detected by: insecure-defaults audit

- [ ] **L7: Race condition in thread_number assignment** — `app/api/review-widget/[token]/comments/route.ts:160-170`, `app/api/review/[token]/comments/route.ts:131-143`
  - Concurrent comments get duplicate thread_numbers (display bug, not security). Use an atomic RPC like `claim_next_quote_number`.
  - Detected by: sharp-edges audit

- [ ] **L8: `tippy.js` archived (3.5+ years)** — `package.json`
  - Stable tooltip library, narrow API surface. Floating UI is the maintained successor if migration needed.
  - Detected by: supply-chain audit

- [ ] **L9: 36/42 deps use floating caret ranges** — `package.json`
  - Lockfile mitigates, but ensure CI uses `npm ci`. Consider pinning `stripe`, `@supabase/supabase-js`, `openai`, `resend` to exact versions.
  - Detected by: supply-chain audit

---

## Passed

- ✅ **Secrets management** — Service role key server-only, no NEXT_PUBLIC_ secrets, .env.local gitignored, no hardcoded credentials — vibe-security (secrets/env audit)
- ✅ **JWT validation** — `getAuthContext()` uses `supabase.auth.getUser()` (server-side verification, not just decode) — vibe-security (auth audit)
- ✅ **Company_id scoping** — Every authenticated route filters by `auth.companyId`. Helpers: `ownsProposal`, `ownsPage`, `ownsTemplate`, `ownsDocument` — vibe-security (auth audit)
- ✅ **No IDOR in authenticated routes** — All resource-by-ID queries also scope to company — vibe-security (auth audit)
- ✅ **Share token entropy** — `crypto.randomUUID()` (122 bits), enumeration infeasible — vibe-security (auth audit)
- ✅ **AI API key protection** — Anthropic key server-side only, never exposed to client — vibe-security (rate-limit/AI audit)
- ✅ **AI prompt injection defenses** — Untrusted content tagged, enum-validated `kind`, no user-controlled system prompt — vibe-security (rate-limit/AI audit)
- ✅ **AI daily quota** — Atomic `increment_ai_usage` RPC, fail-closed on tracking error — vibe-security (rate-limit/AI audit)
- ✅ **Meta token encryption** — AES-256-GCM via dedicated crypto module — vibe-security (secrets/env audit)
- ✅ **SSRF protection in AI generate-text** — `isValidWebhookUrl()` + `redirect: 'manual'` + timeout — vibe-security (rate-limit/AI audit)
- ✅ **Auth endpoint rate limiting** — register, forgot-password, claim-invite, waitlist, billing all rate-limited — vibe-security (rate-limit audit)
- ✅ **Client-side auth guard** — AdminLayout + AuthGuard redirects on no session (UX guard, not security boundary) — vibe-security (auth audit)
- ✅ **Supply chain posture** — Lockfile committed with SHA-512 integrity, no dependency confusion vectors, no critical vulns, no typosquats, all install-script packages verified — supply-chain audit
- ✅ **No hardcoded credentials** — No hardcoded API keys, passwords, or tokens in source; `.env.local` gitignored; no secrets in git history — vibe-security (secrets/env audit)
- ✅ **No SQL injection** — All Supabase `.rpc()` calls use parameterized client; table/column names from hardcoded union types, not user input — static-analysis audit
- ✅ **No command injection** — Zero use of `child_process`, `exec`, `spawn` — static-analysis audit
- ✅ **No insecure deserialization** — No `eval()` found; all `JSON.parse` on untrusted input wrapped in try/catch — static-analysis audit
- ✅ **OAuth security** — `client_id` + `redirect_uri` validated against server-side allowlist; extension OAuth restricts to `*.chromiumapp.org`; Meta OAuth uses CSRF state tokens with single-use + expiry — static-analysis audit
- ✅ **XSS in React components** — `dangerouslySetInnerHTML` uses DOMPurify with tight allowlist; JSON-LD escapes `<` as `<`; `accent_color` validated with hex regex — static-analysis audit

---

## Not Run
- ⚠ **Telemetry setup** — Not audited (Sentry, log drains, cost alerts — one-time wiring)
- ⚠ **Stripe payment surface** — Not audited (behind `PUBLIC_SIGNUP_ENABLED` feature flag, not yet in production)
- ⚠ **Mobile security** — Not audited (admin is desktop-only by design)
- ⚠ **Variant analysis / fp-check** — Deferred to post-fix pass

---

## Recommended Follow-up

1. **Apply SQL migration**: Run `lib/prod-ready-rls-migration.sql` against production Supabase (C1, C2). Verify with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
2. **Verify M12**: Check `swipe_types` and `swipe_files` RLS state on live DB
3. **CSP header**: Add Content-Security-Policy once TipTap/widget `script-src` and `style-src` are catalogued
4. **M3 upload rate limits**: Add per-token/per-company rate limits (20-30/min) to the 5 upload routes
5. **M17 html2canvas**: Evaluate migration to `html-to-image` or `modern-screenshot`
6. **Telemetry wiring**: Set up Sentry error tracking + Supabase/Vercel cost alerts before launch
7. **Rollback drill**: Verify Vercel instant-rollback works; confirm DB migration reversibility
8. **Penetration test the public review widget surface**: Highest-exposure attack surface (runs on customer sites)
