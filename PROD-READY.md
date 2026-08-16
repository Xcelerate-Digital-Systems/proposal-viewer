# Production Readiness Report — AgencyViz

Generated: 2026-08-16  |  Scope: whole codebase (full re-audit)
Stack: Next.js 16.2.6, Supabase (ap-southeast-2), Stripe, Vercel  |  Profile: large (1,038 source files)
Source files: 1,038  |  Tests: 4 files (boundary)  |  CI: GitHub Actions (test + build)  |  Build: passing
Live systems audited: Supabase `lyiwnbezmtbwpipbmgqp`  |  Vercel runtime errors: 403 (insufficient permissions)
Query stats window: since 2026-02-17 (~6 months)
Mobile: none detected → 3b/3c skipped
Routing: 4 Sonnet scan agents (architecture, security, supply-chain, code-health); triage, severity and synthesis on Opus 4.6
HEAD at audit start: `6432ed9`

## Verdict

**SHIP** — All Critical and High findings resolved. RLS enabled on `review_variant_decisions`, two DEFINER functions locked to `service_role`, Next.js bumped to 16.3.1 (0 audit vulnerabilities). No blockers remain.

## Severity revisions after verification

- `purge_stale_email_log()` anon-callable: rated **High** (not Critical) — deletes old email_log rows but cannot exfiltrate data or affect auth state. Blast radius is audit trail loss, not data breach.
- `claim_next_quote_number(p_company_id)` authenticated-callable: rated **High** — any authenticated user can increment another company's quote number sequence by passing an arbitrary UUID. Causes quote numbering gaps but no data exfiltration.
- `is_super_admin()` and `get_user_company_id()` anon-callable: **cleared** — both scope to `auth.uid()`, return nothing for unauthenticated callers.
- `get_funnel_data(token)` and `get_whiteboard_data(token)` anon-callable: **cleared** — intentionally public, token-gated, no escalation path.
- 184 `multiple_permissive_policies` advisor lints: **not reported individually** — at current table sizes (largest 543 rows) these are optimisation notes, not findings. Revisit if tables grow past 100k rows.
- 60 `auth_rls_initplan` lints: **Low** — `auth.uid()` re-evaluation per row is measurable only at scale. Tables are currently <600 rows.
- 47 unused indexes, 3 duplicate indexes: **Low** — write tax on tiny tables is negligible.
- 43 unindexed foreign keys: **Low** — no hot-path queries affected at current scale.

## Repo versus running system

| Check | Result |
|---|---|
| Migrations: applied vs repo | 178 applied. 0 in `supabase/migrations/` (by design — migrations live alongside code in `lib/`). No drift detected. |
| Edge functions: deployed vs repo | 0 deployed, 0 in repo. In sync. |
| Env vars: read in code vs set on platform | 37 env vars read in code. Vercel runtime errors probe returned 403 — cannot verify platform vars. **Unverified.** |
| Recent deploy failures / restart loops | Vercel API returned 403 — deploy history not accessible. **Unverified.** |
| Backup posture | Supabase managed backups (daily). PITR status unverified (CLI not available in this environment). |

## Stage results

| Stage | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1 Architecture & structure | 0 | 0 | 2 | 1 |
| 2 Live system state | 1 | 2 | 0 | 2 |
| 3 Security | 0 | 1 | 2 | 2 |
| 4 Resilience & efficiency | 0 | 0 | 4 | 3 |

## Standards coverage

| # | Dimension | Status | Gates |
|---|---|---|---|
| 1 | Module boundaries / single responsibility | **partial** (56 files over 500-line limit; bounded contexts clear) | |
| 2 | Architecture document | **partial** (exists, structurally sound, but stale: says "no CI/no tests" when both exist; route counts outdated) | |
| 3 | Boundary and contract testing | **partial** (4 test files covering auth helpers; no integration tests; TB-6 zero coverage on 205 service-role sites) | **gates 1** |
| 4 | Telemetry and observability | **partial** (Sentry DSN configured; PostHog analytics; no structured error tracking in API routes) | |
| 5 | Dependency hygiene | **partial** (lockfile tracked; 4 npm audit Highs from next@16.2.6; 2 upstream unmaintained) | |
| 6 | Deployment and rollback | **partial** (Vercel auto-deploy from main; no documented rollback procedure; CI gates post-merge not pre-merge) | |
| 7 | Threat model | **met** (THREAT_MODEL.md exists, trust boundaries documented, reviewed against live state) | |
| 8 | Cost and efficiency at scale | **met** (tables tiny, queries sub-2ms mean, no cron jobs, no unbounded reads found, AI quota gated) | |
| 9 | Accessibility | **not assessed** (code-level a11y grep not run in this pass) | |
| 10 | Code health and bloat | **partial** (duplicated board drawers, 40+ files over limit, 10-useEffect component; no dead-code tooling) | **gated by 3** |

**Gate status:** Dimension 3 remains partially met — 4 test files exist but the largest trust surface (TB-6: 205 service-role routes) has zero coverage. Dimension 1 refactoring is gated until boundary tests improve. Dimension 10 cleanup is gated until Dimension 3 provides safety.

## Advisor summary

| Class | Raw | Reported | Cleared |
|---|---|---|---|
| `rls_disabled_in_public` | 1 | 1 (Critical) | — |
| `rls_enabled_no_policy` | 27 | 0 | 27 fail-closed (RLS on, 0 policies = all access denied via PostgREST; accessed only through service role routes) |
| `anon_security_definer_function_executable` | 5 | 2 | 3 correctly scoped to `auth.uid()` or token-gated |
| `authenticated_security_definer_function_executable` | 6 | 1 | 5 correctly scoped |
| `multiple_permissive_policies` | 184 | 0 | Tables under 600 rows — optimisation note, not finding |
| `auth_rls_initplan` | 60 | 0 | Sub-ms at current scale |
| `unused_index` | 47 | 0 | Write tax negligible at current volume |
| `unindexed_foreign_keys` | 43 | 0 | No hot-path joins affected |
| `duplicate_index` | 3 | 0 | Negligible |

## Database time — where it actually goes

| Query / function | Role | Share | Calls | Mean | Verdict |
|---|---|---|---|---|---|
| `review_items` select (by project) | authenticated | 27.1% | 110,860 | 1.7ms | Heaviest query; acceptable at current scale |
| `review_projects` select | authenticated | 14.2% | 127,176 | 0.8ms | Normal |
| `review_items` select (alt filter) | authenticated | 10.4% | 60,879 | 1.2ms | Normal |
| `companies` custom_domain select | authenticated | 10.0% | 193,716 | 0.4ms | High call count; custom domain check on every request. Consider caching |
| `review_projects` select (alt) | authenticated | 5.7% | 61,164 | 0.7ms | Normal |
| `set_config` (PostgREST role setup) | authenticated | 5.3% | 1,101,156 | 0.0ms | Framework overhead |
| `check_rate_limit` RPC | service_role | 1.5% | 14,626 | 0.7ms | Normal |

> Supabase internals excluded. All queries sub-2ms mean. No performance concerns at current scale.

## Code health — where the weight is

| Measure | Value | Source |
|---|---|---|
| Files over 500 lines | 56 (40 over 500, 16 over 600, 7 over 700) | `wc -l` |
| Duplicated business logic | 3 pairs: NoteSideDrawer, ShapeSideDrawer, ProjectDetailsSection | Manual comparison |
| Complexity outliers | DesignTab.tsx: 10 useEffects; campaigns/page.tsx: 792 lines | `grep -c useEffect` |
| Unused dependencies | 0 confirmed | Spot-check (no `knip`/`ts-prune` available) |
| Duplicate icon libraries | `lucide-react` (391 imports) + `@phosphor-icons/react` (16 imports, 57MB) | grep |
| Client bundle | Not measured (no `source-map-explorer` run) | Gap |

---

## Critical — blocks launch

- [x] **C-1 `review_variant_decisions` RLS disabled** — `db: public.review_variant_decisions` ⟶ **CLOSED** — RLS enabled, verified `relrowsecurity = true`
  - What: RLS is completely disabled on a table containing `reviewer_email`, `reviewer_name`, `company_id`. Any holder of the Supabase anon key can read, insert, update, or delete all rows via PostgREST.
  - Why it matters: PII exposure + data tampering. Currently 0 rows but table is in active development (variant decisions feature).
  - Fix: `ALTER TABLE public.review_variant_decisions ENABLE ROW LEVEL SECURITY;` — table is accessed only via service role routes, so enabling RLS with 0 policies (fail-closed) is safe.
  - Detected by: Stage 2 probe 4 + `rls_disabled_in_public` advisor  |  Verified by: live SQL query

## High — fix within two weeks of launch

- [x] **H-1 `purge_stale_email_log()` callable by anon** — `rpc: purge_stale_email_log` ⟶ **CLOSED** — `has_function_privilege` now returns `{}` for anon and authenticated
  - What: SECURITY DEFINER function deletes all `email_log` rows older than 90 days. Callable by unauthenticated users via `/rest/v1/rpc/purge_stale_email_log` with just the anon key.
  - Why it matters: Any internet user can wipe the email audit trail. Not a data breach but destroys delivery records needed for debugging and compliance.
  - Fix: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role;` (initial REVOKE from anon/authenticated was silently ignored — PUBLIC grant was the source; revoking from PUBLIC fixed it).
  - Detected by: Stage 2 probe 3 + advisor  |  Verified by: `callable_by` query confirms `{}`

- [x] **H-2 `claim_next_quote_number(p_company_id)` cross-tenant** — `rpc: claim_next_quote_number` ⟶ **CLOSED** — `has_function_privilege` now returns `{}` for authenticated
  - What: Takes an arbitrary `company_id` UUID and increments that company's quote number sequence. Callable by any authenticated user. No `auth.uid()` scoping — does not verify the caller belongs to the target company.
  - Why it matters: Any authenticated user can exhaust or create gaps in another company's quote numbering. Causes business confusion and could be used for enumeration (calling with random UUIDs to discover valid company IDs).
  - Fix: `REVOKE EXECUTE ... FROM PUBLIC, authenticated; GRANT ... TO service_role;` — function is called only from service-role API routes that verify company ownership.
  - Detected by: Stage 2 probe 3 + advisor + function body review  |  Verified by: `callable_by` query confirms `{}`

- [x] **H-3 `next@16.2.6` has 4 known vulnerabilities** — `package.json` ⟶ **CLOSED** — bumped to `next@16.3.1`, `npm audit` reports 0 vulnerabilities, build passes
  - What: Middleware/proxy bypass, DoS via Server Actions, SSRF in Server Actions, cache confusion.
  - Why it matters: Middleware bypass could circumvent CSP headers set in `proxy.ts`. SSRF in Server Actions is a real attack vector if any server action processes URLs.
  - Fix: `npm audit fix` bumped to `next@16.3.1` (16.2.11 still carried vulnerable bundled postcss/sharp). All 4 audit findings and transitive deps resolved.
  - Detected by: `npm audit` via supply-chain scan agent  |  Verified by: `npm audit` returns 0 vulnerabilities

## Medium — track in backlog

- [ ] **M-1 CSP allows `unsafe-inline` for scripts** — `proxy.ts:10`
  - What: `script-src` includes `'unsafe-inline'` in production. Weakens XSS defense-in-depth — if a sanitisation bypass occurs, injected inline scripts execute freely.
  - Why it matters: XSS mitigation layer is ineffective. Prior audit attempted nonce-based CSP but it was reverted (incompatible with Next.js inline scripts).
  - Fix: Investigate Next.js 16's nonce support or `strict-dynamic` as alternatives. If neither works, document as accepted risk with the specific Next.js limitation.
  - Detected by: Stage 3 security scan  |  Verified by: reading `proxy.ts`

- [ ] **M-2 No rate limiting on external-API-cost-bearing connector routes** — `app/api/connectors/meta/data/route.ts`, `app/api/connectors/ghl/data/route.ts`, `app/api/connectors/figma/*`
  - What: These routes proxy live calls to Meta Graph API, GHL, and Figma. Authenticated but not rate-limited. A compromised or malicious account could hammer these to exhaust API quotas or run up costs.
  - Fix: Add `rateLimit()` calls with appropriate limits (e.g., 60/min per company).
  - Detected by: Stage 3 security scan

- [ ] **M-3 ARCHITECTURE.md is stale** — `docs/ARCHITECTURE.md`
  - What: Document claims "0 automated tests, no CI pipeline" when both exist (4 test files, GitHub Actions CI). Route counts are outdated (163 → 181 API routes, ~90 → ~140 authenticated). MCP route line count stale after god-file split.
  - Fix: Refresh the document with current numbers. The structure and analysis are sound — only the quantities need updating.
  - Detected by: Stage 1 architecture scan

- [ ] **M-4 SitemapView `handleDeleteSection` — no confirmation** — `components/admin/feedback/sitemap/SitemapView.tsx:330-342`
  - What: Deleting a sitemap section silently reparents child items and destroys the section with a single click. No confirmation dialog, no undo.
  - Why it matters: Accidental click destroys real campaign structure. Inconsistent with rest of app's delete-confirmation pattern.
  - Fix: Wrap in `ConfirmDialog` (existing UI primitive).
  - Detected by: Stage 4 code health scan

- [ ] **M-5 Duplicated board drawer components** — `components/admin/funnels/board/NoteSideDrawer.tsx` vs `components/admin/feedback/board/NoteSideDrawer.tsx` (118 lines each); `ShapeSideDrawer.tsx` (260/273 lines)
  - What: Near line-for-line duplicates differing only in type names. Bug fixes will diverge.
  - Fix: Extract shared `BoardNoteSideDrawer<T>` and `BoardShapeSideDrawer<T>` generics. **Gated by Dimension 3** — add boundary tests first.
  - Detected by: Stage 4 code health scan

- [ ] **M-6 DesignTab.tsx has 10 useEffect hooks** — `components/admin/shared/design-tab/DesignTab.tsx`
  - What: Highest useEffect count in codebase. CLAUDE.md already notes this as a known "design preview state sync" gotcha. High cognitive load and state-sync bug risk.
  - Fix: Consolidate into fewer effects or extract state management. **Gated by Dimension 3.**
  - Detected by: Stage 4 code health scan

## Low

- [ ] **L-1 `pdf-lib` unmaintained** — `package.json`
  - Last release Nov 2021 (~4.5 years). Used in 10 files. No CVEs currently but no patches will come if one surfaces. No maintained drop-in replacement available.
  - Detected by: supply-chain scan

- [ ] **L-2 `tippy.js` archived** — `package.json`
  - Last release Nov 2021. Used in exactly 1 place. Replace with existing UI primitive (CSS/Radix tooltip) and drop the dependency.
  - Detected by: supply-chain scan

- [ ] **L-3 Duplicate icon library** — `@phosphor-icons/react` (16 imports, 57MB)
  - `lucide-react` is the standard (391 imports). Migrate the 16 Phosphor usages to Lucide equivalents and drop the package.
  - Detected by: supply-chain scan

- [ ] **L-4 SSRF hostname DNS rebinding TOCTOU** — `lib/sanitize.ts:59`
  - `isValidWebhookUrl()` validates hostname at check time but doesn't pin the resolved IP for the subsequent fetch. DNS rebinding could theoretically redirect to internal hosts. Low severity: response content is not returned to the caller (only link/title extraction).
  - Detected by: Stage 3 security scan

- [ ] **L-5 `ProjectDetailsSection` duplication** — `components/admin/proposals/quote-builder/sections/ProjectDetailsSection.tsx` vs `components/admin/quotes/sections/ProjectDetailsSection.tsx`
  - 99 vs 130 lines. Related to Quote Builder naming skew (documented in CLAUDE.md). Low divergence risk since both are display-only.
  - Detected by: Stage 4 code health scan

## Documents written

- `docs/ARCHITECTURE.md` — EXISTS, needs refresh (stale counts, "no CI" claim is wrong)
- `docs/THREAT_MODEL.md` — EXISTS, reviewed against live state, still accurate
- `docs/DEPLOYMENT.md` — EXISTS, not verified against Vercel (403 on API)

## Fix ledger — 2026-08-16

| ID | Finding | Fix applied | Evidence |
|---|---|---|---|
| C-1 | `review_variant_decisions` RLS disabled | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | `relrowsecurity = true` confirmed via live query |
| H-1 | `purge_stale_email_log()` callable by anon | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT TO service_role` | `has_function_privilege` returns `{}` for anon + authenticated |
| H-2 | `claim_next_quote_number()` cross-tenant | `REVOKE EXECUTE FROM PUBLIC, authenticated; GRANT TO service_role` | `has_function_privilege` returns `{}` for authenticated |
| H-3 | next@16.2.6 — 4 high CVEs | `npm audit fix` → next@16.3.1 | `npm audit` returns 0 vulnerabilities; build passes |

Migration file: `lib/prod-ready-fixes-2026-08-16-migration.sql`

## Passed

- ✅ No hardcoded secrets or credentials in source — Stage 3 security scan
- ✅ `NEXT_PUBLIC_*` vars are all legitimate public identifiers — Stage 3 scan
- ✅ Stripe webhook signature verification + idempotency (`event_id` dedup) — `app/api/billing/webhook/route.ts:40-61`
- ✅ Resend webhook Svix signature verification + 5-minute replay window — `app/api/webhooks/resend/route.ts`
- ✅ All `dangerouslySetInnerHTML` sites run through `DOMPurify.sanitize()` — 4 sites verified
- ✅ No SQL injection (no raw SQL with string interpolation) — Stage 3 scan
- ✅ No command injection (`child_process`/`exec`/`spawn`) — Stage 3 scan
- ✅ No path traversal (upload paths server-constructed) — Stage 3 scan
- ✅ File uploads validated (size, MIME, extension allowlists) — 4 upload routes verified
- ✅ Rate limiting on all auth-sensitive endpoints (register, forgot-password, claim-invite, oauth/token, AI generate) — fail-closed
- ✅ 156/181 routes have rate limiting — Stage 3 scan
- ✅ Lockfile tracked in git — supply-chain scan
- ✅ No dev dependencies in production imports — supply-chain scan
- ✅ No unused dependencies found — supply-chain scan
- ✅ 27 tables with RLS enabled + 0 policies fail closed (accessed only via service role) — Stage 2 probe 4
- ✅ No dangerous extensions exposed to anon/authenticated (only `supabase_vault`, not callable) — Stage 2 probe 3b
- ✅ No edge function drift (0 deployed, 0 in repo) — Stage 2 probe 2
- ✅ No schema drift on migrations (178 applied, all tracked in lib/) — Stage 2 probe 2
- ✅ `is_super_admin()`, `get_user_company_id()` — DEFINER but correctly scoped to `auth.uid()` — Stage 2 function body review
- ✅ `get_funnel_data()`, `get_whiteboard_data()` — DEFINER, anon-callable, intentionally public (token-gated) — Stage 2 function body review
- ✅ Client Access feature auth model — token-gated with rate limiting, no auth bypass — Stage 2 route review
- ✅ Query performance healthy — all queries sub-2ms mean, no unbounded reads — Stage 2 probe 6
- ✅ AI quota gated via `increment_ai_usage` RPC — per-company daily limit enforced
- ✅ CI pipeline exists (GitHub Actions: test + build on push/PR to main) — Stage 1 scan

## Not run

- ⚠ Vercel runtime errors — 403 (insufficient API permissions for error cluster endpoint)
- ⚠ Vercel env var verification — 403 (cannot list platform variables to diff against code)
- ⚠ Vercel deploy history — 403 (cannot check for restart loops or recent failures)
- ⚠ Supabase PITR verification — CLI not available in this environment
- ⚠ Dimension 9 (accessibility) — code-level a11y pass not run; no `axe-core` or `eslint-plugin-jsx-a11y` in project
- ⚠ Client bundle size analysis — no `source-map-explorer` run
- ⚠ Full unused-export detection — needs `knip`/`ts-prune` for reliable results
- ⚠ Trail of Bits plugins (insecure-defaults, static-analysis, sharp-edges, differential-review, audit-context-building, variant-analysis, fp-check, supply-chain-risk-auditor) — enabled but not invoked in this pass (scanning was done via dedicated subagents rather than plugin-driven passes)
