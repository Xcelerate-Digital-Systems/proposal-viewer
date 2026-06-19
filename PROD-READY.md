# Production Readiness Report — AgencyViz

Generated: 2026-06-10  |  Scope: Whole codebase  |  Stack: Next.js 16.2.6 + Supabase + Stripe + Vercel

## Verdict

**FIX-CRITICAL-FIRST** — 2 Critical findings must be resolved before launch. The codebase is well-architected with strong auth infrastructure, parameterized queries (zero SQL injection surface), solid webhook verification, and proper token generation. The issues below are targeted gaps, not systemic weaknesses.

---

## Critical (blockers — fix before launch)

- [ ] **C1 — Service role key reused as internal auth secret + timing-unsafe comparison**
  `app/api/review-notify/route.ts:44-46`
  - What: The `X-Internal-Secret` header is compared against `SUPABASE_SERVICE_ROLE_KEY` using JavaScript `===`. This transmits the most privileged credential as an HTTP header (any logging/error tracking captures it) AND the comparison is vulnerable to timing attacks that could leak the key byte-by-byte.
  - Why it matters: Full database bypass. An attacker with the key can read/write/delete all data across every tenant.
  - Fix: (1) Create a separate `INTERNAL_NOTIFY_SECRET` env var — never reuse the service role key as an auth token. (2) Replace `===` with `crypto.timingSafeEqual` — reuse the existing `constantTimeEquals` from `lib/oauth-clients/server.ts`.
  - Detected by: SaaS audit, Static analysis

- [ ] **C2 — Unsubscribe token HMAC uses hardcoded fallback secret**
  `lib/feedback/unsubscribe-token.ts:3`
  - What: `const SECRET = () => process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-fallback'` — if the env var is ever undefined at runtime, the HMAC secret falls back to the literal string `'dev-fallback'` (visible in source code). An attacker can forge valid unsubscribe tokens for any (projectId, email) pair.
  - Why it matters: Unauthorized unsubscription of arbitrary users from review notifications. Also reuses the service role key (same anti-pattern as C1).
  - Fix: Remove the fallback. Throw if the env var is missing. Consider a dedicated `UNSUBSCRIBE_TOKEN_SECRET` env var.
  - Detected by: Sharp edges audit

---

## High (fix within first 2 weeks)

- [ ] **H1 — Missing rate limiting on 6+ public token-authenticated routes**
  `app/api/review/[token]/route.ts`, `app/api/funnel/[token]/route.ts`, `app/api/swipe/[token]/route.ts`, `app/api/whiteboard/[token]/route.ts`, `app/api/review-widget/[token]/script/route.ts`, `app/api/review-widget/[token]/heartbeat/route.ts`
  - What: These fully public endpoints have no rate limiting. Share tokens can be brute-forced or used for connection pool DoS.
  - Why it matters: Token enumeration exposes client proposals/campaigns/funnels. DoS against Supabase pool affects all tenants.
  - Fix: Add `rateLimit({ key: \`public:${ipFromRequest(req)}\`, limit: 60, windowSeconds: 60 })` to all public token routes.
  - Detected by: SaaS audit

- [ ] **H2 — Member badge endpoint leaks PII without auth**
  `app/api/member-badge/route.ts:34`
  - What: `GET /api/member-badge?member_id=<uuid>` is fully public with no auth and no rate limiting. Exposes team member names and avatar images.
  - Why it matters: PII leak for any company's team members via UUID enumeration.
  - Fix: Add IP-based rate limiting (30/min). Consider requiring a share_token or company_id scope.
  - Detected by: SaaS audit

- [ ] **H3 — Open redirect via Origin header fallback in checkout**
  `app/api/billing/checkout/route.ts:138`
  - What: If `NEXT_PUBLIC_APP_URL` is unset, the route falls back to the `Origin` request header for Stripe redirect URLs. An attacker can set `Origin: https://evil.com` to redirect users post-payment.
  - Why it matters: Post-payment phishing. Attacker captures the Stripe `session_id`.
  - Fix: Never fall back to `Origin`. Use only `process.env.NEXT_PUBLIC_APP_URL` and fail early if unset.
  - Detected by: SaaS audit

- [ ] **H4 — Cross-tenant notification spam via review-notify**
  `app/api/review-notify/route.ts:54`
  - What: Auth check validates the Bearer token belongs to *any* Supabase user, but doesn't verify the user belongs to the company that owns the project. Any authenticated user can trigger notifications for any project.
  - Why it matters: Cross-tenant notification spam, burns Resend email quota.
  - Fix: After validating the user, verify their `companyId` matches the project's `company_id`.
  - Detected by: SaaS audit

- [ ] **H5 — Missing SSRF protection on transcription fetch**
  `app/api/ads/swipe/files/[id]/transcribe/route.ts:39`
  - What: `media_url` is fetched without SSRF validation. If the DB value is modified after initial import validation, this endpoint blindly fetches from internal/private addresses and sends the response to OpenAI.
  - Why it matters: SSRF → internal service access → data exfiltration through transcription result.
  - Fix: Add `isValidWebhookUrl(file.media_url)` check before the fetch.
  - Detected by: Static analysis

---

## Medium (fix before or shortly after launch)

- [ ] **M1 — CSP allows `'unsafe-eval'` in production**
  `next.config.js:25`
  - What: `script-src` includes `'unsafe-inline' 'unsafe-eval'`, substantially weakening XSS protections.
  - Fix: Remove `'unsafe-eval'` from production CSP and test. Use nonces + `strict-dynamic` if needed by Stripe/PostHog.
  - Detected by: Sharp edges audit

- [ ] **M2 — Environment variable non-null assertions without runtime validation**
  `lib/supabase.ts:4-5`, `lib/supabase-server.ts:18-19`
  - What: TypeScript `!` assertions on critical env vars. Missing vars cause silent failures or cryptic errors.
  - Fix: Add runtime guards that throw on missing env vars at initialization.
  - Detected by: Sharp edges audit

- [ ] **M3 — Review widget uses innerHTML extensively (40+ sites)**
  `app/api/review-widget/[token]/script/parts/panel.ts`, `parts/annotations.ts`
  - What: Vanilla JS widget uses `innerHTML` for rendering. While `esc()` and `sanitiseDisplay()` exist, they're opt-in per call site. One missed sanitization = XSS on the *client's* website.
  - Fix: Audit every `innerHTML` assignment. Switch to `textContent` for non-HTML rendering.
  - Detected by: Sharp edges audit

- [ ] **M4 — Swipe file public endpoint returns `SELECT *`**
  `app/api/swipe/[token]/route.ts:18`
  - What: Returns all columns including internal fields (company_id, user_id, etc.) to anonymous viewers.
  - Fix: Replace `select('*')` with an explicit column allowlist.
  - Detected by: SaaS audit

- [ ] **M5 — Domain parameter injection in Vercel API path**
  `app/api/company/domain/route.ts:40,80,188,272`
  - What: Domain values interpolated directly into Vercel API URL paths without encoding. GET/DELETE paths read from DB, bypassing regex validation.
  - Fix: Use `encodeURIComponent(domain)` in all Vercel API path interpolations.
  - Detected by: Static analysis

- [ ] **M6 — Error messages leak internal details to clients**
  `app/api/billing/checkout/route.ts:175`, `app/api/campaigns/[id]/ad-variations/route.ts:32,102`, `app/api/ads/swipe/files/[id]/transcribe/route.ts:81`
  - What: Raw Supabase/Stripe/OpenAI error messages returned to clients. Can include table names, constraint names, API endpoints.
  - Fix: Return generic messages to clients, log details server-side.
  - Detected by: SaaS audit, Static analysis, Sharp edges audit

- [ ] **M7 — No rate limiting on 80+ authenticated write routes**
  Most `app/api/` POST/PATCH routes
  - What: A compromised session can create unlimited resources. Key gaps: proposals, documents, campaigns, templates, team operations.
  - Fix: Add per-company rate limiting to write endpoints (e.g. 30/min).
  - Detected by: SaaS audit

- [ ] **M8 — OAuth plaintext token storage window**
  `app/api/oauth/token/route.ts:93-96`
  - What: `oauth_auth_codes` stores `plaintext_token` between creation and consumption. DB compromise during this window exposes API keys.
  - Fix: Encrypt at rest using the Meta token encryption pattern, or store only a derivable reference.
  - Detected by: SaaS audit

---

## Low (track in backlog)

- [ ] **L1 — Math.random() for storage paths** — `app/api/ads/swipe/files/import-from-url/route.ts:199`, `upload/route.ts:68`. Use `crypto.randomUUID()` for Supabase Storage paths.
- [ ] **L2 — Email validation lacks length check** — `lib/sanitize.ts:96`. Add `&& email.length <= 254`.
- [ ] **L3 — Invite token validation reveals status** — `app/api/invites/validate/route.ts:34-38`. Return generic "Invalid or expired" for all failures.
- [ ] **L4 — CORS wildcard helper is a footgun** — `lib/cors.ts:11`. Safe for current API-key-auth usage, but add a guard comment or lint rule to prevent use on cookie-auth routes.
- [ ] **L5 — Cron endpoints accept GET and POST** — `app/api/cron/flush-review-notifications/route.ts:237-244`. Consider POST-only.

---

## Supply Chain

- **1 moderate CVE**: `postcss` XSS (GHSA-qx2v-qp2m-jg93) — transitive via `next@16.2.6`. Low practical risk for this app. Fix: upgrade to `next@16.3.0` when stable.
- **0 high/critical CVEs**, 0 typosquats, 0 malicious install scripts.
- **Lockfile**: v3, committed, all 716 packages have SHA-512 integrity hashes.
- **Note**: Dual icon libraries (`lucide-react` + `@phosphor-icons/react`) — consider consolidating to reduce bundle/attack surface.

---

## Passed

- ✅ **SQL Injection** — Zero raw SQL. All DB access via Supabase parameterized client. (Static analysis)
- ✅ **Command Injection** — No `exec`, `spawn`, `eval`, `new Function()` in application code. (Static analysis)
- ✅ **Path Traversal** — No file system operations in API routes. All storage via Supabase Storage. (Static analysis)
- ✅ **XSS (React)** — Only 2 `dangerouslySetInnerHTML` uses, both properly sanitized (JSON-LD escape + DOMPurify). (Static analysis)
- ✅ **Stripe Webhook** — Proper `constructEvent()` signature verification + idempotency dedup table. (SaaS audit)
- ✅ **Token Generation** — All security tokens use `crypto.randomBytes(32)` or `crypto.randomUUID()`. No `Math.random()` for secrets. (Sharp edges audit)
- ✅ **SSRF Protection** — `isValidWebhookUrl()` blocks private IPs (IPv4+IPv6), link-local, CGNAT, metadata endpoints, decimal/octal/hex tricks, auth-embedded URLs. (SaaS audit)
- ✅ **OAuth Flow** — State CSRF protection (hash + time-bound + single-use), redirect_uri allowlist validation, 120s code expiry. (Sharp edges audit)
- ✅ **Secrets Management** — No hardcoded secrets in source. `.env` files gitignored. API keys hashed with SHA-256. (SaaS audit)
- ✅ **Security Headers** — CSP, HSTS (2yr), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, restrictive Permissions-Policy. (Architecture audit)
- ✅ **NEXT_PUBLIC Secrets** — All client-exposed env vars are intentionally public (anon key, publishable key, analytics key). (Architecture audit)
- ✅ **Auth Infrastructure** — `getAuthContext()` with proper JWT validation, company_id scoping, role-based permissions, super-admin gating. (Architecture audit)
- ✅ **Rate Limiting (auth endpoints)** — Forgot-password, register, login, OAuth token all rate-limited with fail-closed. (SaaS audit)
- ✅ **Email Enumeration Prevention** — Forgot-password returns 200 regardless of email existence. (Architecture audit)
- ✅ **Lockfile Integrity** — package-lock.json v3, committed, all integrity hashes present. (Supply chain audit)

---

## Not Run

- ⚠ **Supabase RLS policy audit** — Would require querying the live database to enumerate RLS policies. Not covered by static analysis. Recommend running `supabase db lint` against the live project.
- ⚠ **Telemetry/observability** — Sentry, log drains, cost alerts not audited. PostHog is wired for analytics but error monitoring coverage is unknown.
- ⚠ **Rollback readiness** — Vercel instant-rollback capability and DB migration reversibility not verified.
- ⚠ **Load/performance testing** — Not in scope for security audit. Recommend testing Supabase connection pool under concurrent load.
- ⚠ **Penetration testing** — Static analysis only. No dynamic/runtime testing performed.

---

## Recommended Follow-up

1. **Run Supabase RLS audit** — `supabase db lint` or manual review of all RLS policies. This is the biggest blind spot in a static-only audit.
2. **Wire up error monitoring** — Sentry or equivalent for production error tracking. Currently no evidence of structured error monitoring beyond `console.error`.
3. **Rollback drill** — Verify Vercel instant-rollback works. Test that the last 3 DB migrations are reversible.
4. **Rate limit the remaining public routes** (H1) — This is the highest-ROI fix after the two Criticals.
5. **Review widget security audit** — The vanilla JS widget injected on client sites warrants a dedicated pass given its 40+ innerHTML sites and third-party execution context.
6. **Consider WAF/bot protection** — Vercel's built-in or Cloudflare for the public viewer routes, especially before launch marketing drives traffic.
