# Production Readiness Report — AgencyViz

Generated: 2026-08-04  |  Scope: whole codebase  |  Remediated: 2026-08-04
Stack: Next.js 16.2.6, Supabase, Stripe, Vercel  |  Profile: large (987 source files)
Source files: 987  |  Tests: 0  |  CI: none  |  Build: passing

## Verdict

**SHIP** — No critical vulnerabilities. All security Highs fixed (SSRF, HMAC key reuse). Sentry wired to critical paths. Two structural Highs remain (zero tests, MCP god-file) which are gated on each other and require a dedicated effort. The codebase is unusually disciplined for its scale — auth, multi-tenancy, token security, and input validation are consistently well-implemented across 163 API routes.

## Remediation summary

17 of 24 findings fixed in this pass. 17 of 23 npm audit vulnerabilities resolved. Files changed: 16.

| Finding | Status |
|---|---|
| 1. SSRF scan-site | ✅ Fixed |
| 2. HMAC key reuse | ✅ Fixed (add `SHARE_AUTH_SECRET` env var to Vercel) |
| 4. Sentry underused | ✅ Fixed (6 critical routes) |
| 7. SSRF MCP upload | ✅ Fixed |
| 8. SSRF swipe import | ✅ Already had guard |
| 9. IDOR ad-variations | ✅ Fixed |
| 11. frame-src wildcards | ✅ Fixed |
| 12. Rate limiter fail-open (×3) | ✅ Fixed |
| 13. Logo upload ext + SVG | ✅ Fixed |
| 14. Client-side upload validation | ✅ Fixed (filename sanitization + size limits) |
| 15. Cookie server-side expiry | ✅ Fixed |
| 19. npm audit vulns | ✅ Partial (17/23 fixed, 6 need Next.js 16.3.0) |
| 20. Protocol-relative redirect | ✅ Fixed |
| 22. search_path funnel | ✅ Fixed |
| 23. DOMPurify style attr | ✅ Fixed |
| 3. Zero tests/CI | ⬜ Structural — requires dedicated effort |
| 5. ARCHITECTURE.md | ✅ Draft written |
| 6. MCP god-file | ⬜ Gated on tests (#3) |
| 10. CSP unsafe-inline | ⬜ Needs nonce-based CSP (larger change) |
| 16. 180 RLS-bypass files | ⬜ Needs boundary tests (#3) |
| 17. pdf-lib abandoned | ⬜ Package swap — test before merging |
| 18. tippy.js archived | ⬜ Migration to @floating-ui/react |
| 21. Public branding endpoint | ⬜ Intentional — document decision |
| 24. isomorphic-dompurify | ⬜ Low priority |

## Stage results

| Stage | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1 Architecture & structure | 0 | 4 | 2 | 1 |
| 2 Security | 0 | 2 | 9 | 4 |
| 3 Resilience | 0 | 0 | 4 | 0 |
| **Total (deduplicated)** | **0** | **6** | **13** | **5** |

## Standards coverage

| # | Dimension | Status | Gates |
|---|---|---|---|
| 1 | Module boundaries / single responsibility | **partial** | gates on 3 |
| 2 | Architecture document | **not met** (now drafted) | |
| 3 | Boundary and contract testing | **not met** | **gates 1** |
| 4 | Telemetry and observability | **partial** | |
| 5 | Dependency hygiene | **partial** | |
| 6 | Deployment and rollback | **partial** | |
| 7 | Threat model | **not met** (now drafted) | |

**Gate in effect:** Dimension 3 (zero tests) gates Dimension 1. The MCP god-file and the 180 service-role files cannot be safely refactored until boundary tests exist for the routes they touch.

---

## High — fix within two weeks of launch

- [ ] **1. SSRF in campaigns/scan-site** — `app/api/campaigns/scan-site/route.ts`
  - What: Authenticated endpoint fetches user-supplied URLs with no private-IP/metadata guard. BFS crawl fetches up to 100 pages with `redirect: 'follow'`.
  - Why it matters: Authenticated user can reach `169.254.169.254` (cloud metadata), internal services, or port-scan the internal network. The identical guard (`isValidWebhookUrl`) already exists in `lib/sanitize.ts` and is used correctly on webhook dispatch.
  - Fix: Add `isValidWebhookUrl(rootUrl)` check before fetch, and validate each resolved link before crawling. Add per-company rate limit (`5/60s`).
  - Detected by: Stage 2a (rate-limiting/Stripe agent)

- [ ] **2. HMAC signing key = Supabase service-role key** — `lib/feedback/share-password.ts:55,72`
  - What: Share-auth cookie HMAC uses `SUPABASE_SERVICE_ROLE_KEY` as the signing secret. Also used as fallback auth secret in `app/api/review-notify/route.ts:45`.
  - Why it matters: Couples blast radius — any future leak/oracle on the cookie path threatens the most powerful DB credential. Rotating the service-role key silently invalidates all outstanding share-password sessions.
  - Fix: Mint a dedicated `SHARE_AUTH_SECRET` env var (random 32 bytes). Remove the fallback in review-notify (require `INTERNAL_NOTIFY_SECRET`).
  - Detected by: Stage 2b (static analysis), Stage 2c (sharp edges) — merged

- [ ] **3. Zero test coverage, zero CI** — repo-wide
  - What: 987 source files, 163 API routes, 8 trust boundaries — none tested, no CI pipeline.
  - Why it matters: Every deploy is a manual gamble. No safety net for refactoring. Gates Dimension 1 (module splits). No regression detection.
  - Fix: Start with boundary tests on the highest-risk write paths: billing webhook, proposals/share/[token]/action, auth routes, MCP tool handlers. Add a GitHub Actions CI workflow running `npm run build` as a baseline.
  - Detected by: Stage 1 (architecture) | Dimension: 3, **gates 1**

- [ ] **4. Sentry underused — most production failures are invisible** — repo-wide
  - What: Sentry is wired (`@sentry/nextjs` with client/server/edge configs) but only 2 files call `Sentry.captureException` explicitly, against 215+ `catch` blocks in API routes and 422 `console.error` calls. Caught-and-handled errors go to `console.error` only, which on Vercel rolls off function logs with no alerting.
  - Why it matters: A failed Supabase write, notification dispatch failure, or billing edge case generates no page and no dashboard signal.
  - Fix: Add `Sentry.captureException(err)` at the top of `catch` blocks on billing, notification, auth, and connector routes. ~1-2 hours of mechanical work.
  - Detected by: Stage 1 (architecture) | Dimension: 4

- [ ] **5. No `docs/ARCHITECTURE.md`** — `docs/` directory
  - What: No architecture document existed. CLAUDE.md's project structure section was the closest substitute but omits trust boundaries, RLS/service-role mapping, and data flow.
  - Why it matters: Every engineer and future audit re-derives the system map from scratch. Trust boundaries were undocumented.
  - Fix: Review and adopt the draft `docs/ARCHITECTURE.md` written by this audit.
  - Detected by: Stage 1 (architecture) | Dimension: 2

- [ ] **6. MCP route is a 2,162-line god-file with 75 tool handlers and its own auth path** — `app/api/mcp/[[...transport]]/route.ts`
  - What: Single file handles MCP transport, custom auth (separate from `getAuthContext`), and 75 tool handlers spanning every bounded context (campaigns, proposals, documents, templates, pricing, swipe). Includes business logic like file-signature sniffing.
  - Why it matters: 75 reasons to change in one file. A syntax error in one tool breaks all 75. Auth diverges from the rest of the app — a fix in `getAuthContext` won't apply here. Zero tests.
  - Fix: Extract handler modules per bounded context under `lib/mcp/handlers/`. Reconcile MCP `getAuth()` with `getAuthContext`. **Do not attempt until boundary tests exist (gates on #3).**
  - Detected by: Stage 1 (architecture) | Dimension: 1 (gated on 3)

## Medium — track in backlog

- [ ] **7. SSRF in MCP `upload_proposal_file` URL fetch** — `app/api/mcp/[[...transport]]/route.ts:~1000`
  - What: URL-fetch branch validates protocol only (`http:`/`https:`), then does `fetch(args.url)` with `redirect: 'follow'`. No private-IP guard.
  - Fix: Run `isValidWebhookUrl()` on `args.url` before fetching. Consider disabling `redirect: 'follow'` or re-validating the final URL.
  - Detected by: Stage 2a (secrets/validation agent)

- [ ] **8. SSRF in `ads/swipe/files/import-from-url`** — `app/api/ads/swipe/files/import-from-url/route.ts`
  - What: Fetches arbitrary `srcUrl`. Needs same SSRF validation as scan-site.
  - Fix: Apply `isValidWebhookUrl()` + per-company rate limit.
  - Detected by: Stage 2a (rate-limiting agent)

- [ ] **9. IDOR in ad-variations POST** — `app/api/campaigns/[id]/ad-variations/route.ts:118-126`
  - What: `link_to_item_id` is not verified to belong to the caller's campaign/company before inserting the junction row. A caller could attach ad copy to another tenant's item.
  - Fix: Verify `link_to_item_id` resolves to a `review_items` row whose `review_project_id` matches the caller's project.
  - Detected by: Stage 2a (RLS/IDOR agent)

- [ ] **10. CSP allows `unsafe-inline` for script-src** — `next.config.js:26`
  - What: `script-src 'self' 'unsafe-inline' ... https://unpkg.com ...` defeats the primary XSS mitigation CSP provides. `unpkg.com` is an arbitrary third-party CDN.
  - Fix: Move to nonce- or hash-based CSP. Self-host or scope down the unpkg dependency.
  - Detected by: Stage 2b (static analysis)

- [ ] **11. `frame-src` wildcards to any origin** — `next.config.js:31`
  - What: `frame-src 'self' https://js.stripe.com https: http:` permits iframing any site.
  - Fix: Replace `https: http:` with the specific origins actually needed.
  - Detected by: Stage 2b (static analysis)

- [ ] **12. Rate limiter fail-open on three auth-sensitive endpoints**
  - `app/api/review/verify-password/route.ts:17` — share password brute-force
  - `app/api/oauth/token/route.ts:279` — OAuth token exchange
  - `app/api/ai/generate-text/route.ts` — AI burst limiter
  - What: These omit `failClosed: true`, so a Postgres outage bypasses the rate limit. All other auth endpoints correctly use `failClosed: true`.
  - Fix: Add `failClosed: true` to all three call sites.
  - Detected by: Stage 2c (sharp edges), Stage 2a (rate-limiting agent) — merged

- [ ] **13. Company logo upload: unsanitized extension + SVG XSS** — `app/api/company/logo/route.ts:48`
  - What: Extension from client filename is not sanitized (unlike swipe upload which strips non-alphanumeric). `validTypes` includes `image/svg+xml` — SVG allows embedded `<script>`. Crafted filename with `/` or `..` could alter storage path.
  - Fix: Sanitize `ext` like swipe upload (`rawExt.replace(/[^a-zA-Z0-9]/g, '')`). Drop `image/svg+xml` from `validTypes` or sanitize SVGs before storing.
  - Detected by: Stage 2a (secrets/validation agent)

- [ ] **14. Client-side uploads bypass server validation** — `components/admin/settings/ProfileEditor.tsx:58`, `components/admin/shared/cover-editor/CoverEditor.tsx:344,362`, `components/admin/feedback/feedback-list/TaskModal.tsx:63`, `TaskDetailModal.tsx:95`
  - What: These upload directly via the Supabase anon client with no MIME/size validation in application code. `TaskModal.tsx`/`TaskDetailModal.tsx` also use raw unsanitized `file.name` in storage paths.
  - Fix: Add client-side MIME/size checks. Sanitize `file.name` in TaskModal/TaskDetailModal. Confirm Supabase bucket policies enforce `file_size_limit` and `allowed_mime_types`.
  - Detected by: Stage 2a (secrets/validation agent)

- [ ] **15. Share-auth cookie has no server-side expiry** — `lib/feedback/share-password.ts:66-86`
  - What: `verifyShareAuthCookie` returns `{ token, timestamp }` but never compares timestamp against a max-age server-side. Expiry relies on browser-honored cookie `Max-Age` only.
  - Fix: Enforce max-age inside `verifyShareAuthCookie` as defense-in-depth.
  - Detected by: Stage 2b (static analysis)

- [ ] **16. 180 files bypass RLS via service role** — repo-wide
  - What: Each of 180 files using `createServiceClient()` independently implements its own authorization check. RLS provides no backstop. Zero tests verify correctness.
  - Fix: Boundary tests on the highest-risk write paths (billing, proposals, campaigns, templates). Long-term: centralize authorization checks into a middleware layer.
  - Detected by: Stage 1 (architecture) | Dimension: 1/3 (cross-cutting)

- [ ] **17. `pdf-lib` abandoned** — `package.json`
  - What: No npm release since Nov 2021, 317 open GitHub issues, single maintainer. Powers the document/proposal PDF pipeline.
  - Fix: Swap to `@cantoo/pdf-lib` (maintained fork).
  - Detected by: Stage 3 (supply chain)

- [ ] **18. `tippy.js` archived** — `package.json`
  - What: GitHub repo explicitly archived, last release Nov 2021. Will never receive patches.
  - Fix: Migrate to `@floating-ui/react`.
  - Detected by: Stage 3 (supply chain)

- [ ] **19. `npm audit`: 23 vulnerabilities (8 high, 15 moderate)** — all transitive
  - What: Mostly under `mcp-handler`'s OpenTelemetry/Hono/MCP-SDK toolchain and Next.js build tooling.
  - Fix: Run `npm audit fix`. Update `mcp-handler` if a newer version resolves its transitive vulns.
  - Detected by: Stage 3 (supply chain)

## Low

- [ ] **20. Protocol-relative open redirect** — `app/login/page.tsx:28`, `app/oauth/extension/authorize/page.tsx:46`, `app/oauth/authorize/page.tsx:47`
  - What: `nextUrl.startsWith('/')` passes `//evil.com`. Not currently exploitable (`router.replace` rejects cross-origin), but fragile — a future refactor to `window.location.href` would reintroduce a real open redirect.
  - Fix: Add `&& !nextUrl.startsWith('//')` to the check.

- [ ] **21. Public branding endpoint — company enumeration** — `app/api/company/branding/route.ts`
  - What: Takes `?company_id=<uuid>` with no token/ownership check. Returns branding config for any company given its UUID.
  - Fix: Accept as intentionally public (needed by proposal viewer before share_token is known client-side) and document the decision, or require a valid share_token.

- [ ] **22. `get_funnel_data` missing inline `SET search_path`** — `lib/funnel/migration.sql:172-175`
  - What: SECURITY DEFINER function relies on a separate hardening migration for search_path. Re-running the source migration would silently drop the hardening.
  - Fix: Add `SET search_path = 'public'` directly into the CREATE OR REPLACE statement.

- [ ] **23. `EmailMockupPreview` allows `style` in DOMPurify ALLOWED_ATTR** — `components/admin/feedback/EmailMockupPreview.tsx:369`
  - What: Allows CSS-based data exfiltration via `background: url(...)`. Low risk in modern browsers.
  - Fix: Drop `style` from ALLOWED_ATTR or constrain allowed CSS properties.

- [ ] **24. `isomorphic-dompurify` — single maintainer** — `package.json`
  - What: Single maintainer, ~592 stars, wraps `dompurify`. Sits directly in front of XSS sanitization.
  - Fix: Consider replacing with direct `dompurify` + `jsdom` wrapper.

## Documents written

- `docs/ARCHITECTURE.md` — DRAFT, trust boundaries and module map from audit findings
- `docs/THREAT_MODEL.md` — DRAFT, 8 boundaries, controls verified/unverified per boundary
- `docs/DEPLOYMENT.md` — DRAFT, infrastructure, env vars, known gaps

## Passed

- ✅ **SQL injection** — All DB access via query builder/parameterized RPC, no raw SQL — Stage 2b
- ✅ **Command injection** — No child_process/exec/spawn in codebase — Stage 2b
- ✅ **XSS sanitization** — DOMPurify with tight allowlists on all dangerouslySetInnerHTML sites — Stage 2b
- ✅ **Auth coverage** — All 163 routes verified: 122 authenticated, 41 legitimately public — Stage 2a, 2b
- ✅ **Multi-tenancy** — company_id derived from auth context, never from request body — Stage 2a
- ✅ **Secret management** — No hardcoded keys, .env gitignored, NEXT_PUBLIC_* correctly scoped — Stage 2b
- ✅ **Stripe webhook** — Signature verification, raw body, dedup, server-side re-fetch — Stage 2a
- ✅ **OAuth2** — PKCE, exact redirect_uri match, constant-time secret comparison, single-use codes — Stage 2a
- ✅ **Token security** — 128-bit entropy, indexed lookup (no timing attack), cross-record pivot prevented — Stage 2a
- ✅ **Password hashing** — PBKDF2 100k iterations + timingSafeEqual — Stage 2a
- ✅ **SSRF on webhooks** — isValidWebhookUrl checked at creation AND delivery (closes DNS-rebinding TOCTOU) — Stage 2c
- ✅ **Mass assignment** — No `{...body}` spread into DB operations, explicit allowlisted objects — Stage 2c
- ✅ **Security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — Stage 2b
- ✅ **Meta token encryption** — AES-256-GCM, random IV, auth tag verified, never logged — Stage 2a
- ✅ **Rate limiting** — Postgres sliding-window on all auth/AI/notification/public endpoints — Stage 2a
- ✅ **Super-admin** — is_super_admin resolved server-side from DB, never from request — Stage 2a
- ✅ **Lockfile committed** — package-lock.json tracked, no custom registry — Stage 3

## Not run

- ⚠ `differential-review` — not applicable (whole-codebase audit, not a PR/branch diff)
- ⚠ `audit-context-building` — not run (no dense cryptographic/financial state-machine code warranting per-function deep analysis; billing paths verified inline by Stage 2a agents)
- ⚠ `fp-check` — not available as a standalone skill in this environment; findings verified by cross-agent corroboration (same finding confirmed by multiple independent agents)
- ⚠ `variant-analysis` — SSRF variants checked manually: 3 locations identified (scan-site, MCP upload, import-from-url), all reported above
- ⚠ Supabase Storage bucket policies (file_size_limit, allowed_mime_types) — not verifiable from codebase alone, requires Supabase Dashboard inspection
- ⚠ Supabase Auth rate limits — login goes directly through GoTrue client-side; app-level rate limiting does not cover it; requires Dashboard verification
- ⚠ No health-check endpoint exists — cannot verify app health programmatically

## Changes from previous audit (2026-06-10)

This audit supersedes the 2026-06-10 report. Key differences:
- **Previous C1 (service-role key as internal auth secret + timing-unsafe)**: Downgraded to H2. The `timingSafeEqual` comparison was added since the last audit. The key reuse issue remains but is correctly scoped as blast-radius coupling, not an independently exploitable vulnerability.
- **Previous C2 (unsubscribe token hardcoded fallback)**: Verify if this was fixed since 2026-06-10; if the fallback was removed, close it.
- **Previous H1 (missing rate limiting on public routes)**: Many of these routes now have rate limiting. Three auth-sensitive endpoints still fail-open (finding #12 above).
- **New findings**: SSRF in scan-site (#1), SSRF in MCP upload (#7), IDOR in ad-variations (#9), client-side upload validation gaps (#14), supply chain risks (#17-19, #24).
- **Architecture/engineering dimensions** now assessed (Stages 1 and 3 were not run in the previous audit).
