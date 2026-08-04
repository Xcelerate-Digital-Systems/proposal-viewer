# AgencyViz Threat Model

**Status:** Draft
**Last updated:** 2026-08-04
**Source:** Security audit pass (routes, RLS-bypass files, trust boundaries). See Scope for what was and wasn't covered.

> ASSUMPTION: This document reflects a point-in-time audit. It has not been reviewed by every code owner and should be re-validated each time a new trust boundary (new public route, new webhook source, new MCP tool) is added.

---

## 1. Scope

AgencyViz is a B2B SaaS for agencies (`app.agencyviz.io`, Vercel-hosted) built on Next.js (App Router) with Supabase (PostgreSQL + Auth + Storage + RLS) as the data layer. It handles:

- Authenticated agency-side admin surfaces (proposals, quotes, documents, campaigns/markup, funnels, templates, integrations, billing, team management).
- Public, token-scoped viewer surfaces for agency clients (`/view/[token]`, `/doc/[token]`, `/review/[token]`, `/funnel/[token]`, `/swipe/[token]`, `/whiteboard/[token]`).
- Third-party integrations: Stripe (billing), Resend (email), Meta (ads data passthrough for Looker Studio), OAuth2 clients (Looker Studio connectors, Zapier/Make-style third parties), and an internal MCP server exposing 75 tool handlers.

**In scope for this pass:** all 122 authenticated API routes, all public token-scoped viewer flows, Stripe webhook handling, OAuth2 authorization/token flows, the MCP tool-handler surface, and the ~180 files that use the Supabase service-role client (bypass RLS).

**Explicitly not fully audited this pass:**
- TB-4 (Resend inbound/outbound webhooks) — flagged below as not fully audited.
- Client-side dependency/supply-chain review.
- Infrastructure/network layer (Vercel platform hardening, DNS, WAF) — treated as out of AgencyViz's direct control.

> ASSUMPTION: Vercel's platform-level protections (DDoS mitigation, edge network isolation) are assumed adequate and are not re-litigated here — this document covers the application layer only.

---

## 2. Trust Boundaries

Each boundary lists the controls enforced when data/requests cross from a lower-trust actor into a higher-trust context, and their verification status.

### TB-1: Browser → Authenticated API (Bearer token)
| | |
|---|---|
| **Actors** | Logged-in agency users (Owner/Admin/Member), super-admins |
| **Entry point** | All `/api/*` admin routes (122 routes) |
| **Controls** | `getAuthContext()` (`lib/api-auth.ts`) extracts user, `companyId`, `role`, `isSuperAdmin` from the Bearer token before any data access. `requirePermission()` enforces the Owner/Admin/Member matrix (`lib/permissions.ts`). |
| **Status** | **Verified.** All 122 authenticated routes call `getAuthContext`/`requirePermission` before touching data. `company_id` is always derived from the auth context server-side — never accepted from the request body (rules out horizontal tenant-hopping via a forged `company_id` field). |

### TB-2: Public Guest → Token-Scoped Viewers (share tokens)
| | |
|---|---|
| **Actors** | Unauthenticated clients/guests holding a share link |
| **Entry point** | `/view/[token]`, `/doc/[token]`, `/review/[token]`, `/funnel/[token]`, `/swipe/[token]`, `/whiteboard/[token]` and their API counterparts |
| **Controls** | 128-bit tokens (`gen_random_uuid()` or `gen_random_bytes(16)`) — not brute-forceable. Token lookup via indexed unique-column equality (no length/timing side-channel from `LIKE`-style comparison). Cross-record pivot is prevented — item ownership is re-verified against the token-resolved project on every access, not trusted from a nested ID. Internal-stage content is gated via `isGuestVisibleStage`/`isInternalStage`. Optional password protection uses PBKDF2 (100k iterations) + `timingSafeEqual`. Optional `share_expires_at` expiration. |
| **Status** | **Mostly verified**, with one gap: |
| **UNVERIFIED** | The share-auth cookie (set after a guest supplies the correct password) has no server-side expiry check of its own — it appears to be trusted for the life of the cookie regardless of `share_expires_at` or a subsequent password rotation. |

> ASSUMPTION: The share-auth cookie is httpOnly and scoped to the token's path, limiting exposure to XSS on that specific viewer route — this wasn't independently re-verified in this pass and should be confirmed against the actual `Set-Cookie` attributes in code.

### TB-3: Stripe → Billing Webhook
| | |
|---|---|
| **Actors** | Stripe (server-to-server) |
| **Entry point** | `/api/billing/webhook` |
| **Controls** | Signature verification via `stripe.webhooks.constructEvent` before any processing. Raw request body text is used for verification (not parsed JSON, which would break the signature). Deduplication via a unique constraint on `stripe_webhook_events`. Subscription state is re-fetched server-side from Stripe rather than trusted from the webhook payload (defends against a compromised/replayed payload asserting a false plan/status). |
| **Status** | **Verified — solid.** No changes recommended. |

### TB-4: Resend → Webhooks
| | |
|---|---|
| **Actors** | Resend (server-to-server) |
| **Entry point** | Resend webhook endpoint(s), if configured |
| **Controls** | Not enumerated in this pass |
| **Status** | **NOT FULLY AUDITED.** Needs the same treatment as TB-3: signature verification, raw-body handling, replay/dedup protection. |

> ASSUMPTION: If AgencyViz does not currently consume inbound Resend webhooks (only sends outbound email), this boundary may not exist in practice — confirm before prioritizing a follow-up audit.

### TB-5: MCP Clients → 75 Tool Handlers
| | |
|---|---|
| **Actors** | MCP clients (Claude Desktop/Code, or other MCP-speaking tools) authenticated with an API key |
| **Entry point** | MCP server tool handlers (`upload_proposal_file`, `create_proposal`, etc. — 75 total) |
| **Controls** | Custom `getAuth` implementation (separate from `lib/api-auth.ts`) validates Bearer token via `hashApiKey` lookup. `companyIdOverride` (used by super-admins to act on another company) is gated on `isSuperAdmin`. |
| **Status** | **Partially verified — two open risks:** |
| **RISK** | The MCP server is a single 2,162-line file with its own auth path that has diverged from `lib/api-auth.ts`. Divergence is a standing risk: any future fix to the canonical auth logic (rate limiting, token revocation, permission changes) will not automatically apply here unless someone remembers to port it. |
| **RISK** | `upload_proposal_file` fetches an arbitrary URL server-side with no SSRF guard — same class of bug as finding #1 below, on a different surface. |

### TB-6: 180 Service-Role Files (RLS bypass)
| | |
|---|---|
| **Actors** | Any authenticated caller reaching a server-side code path that uses `createServiceClient()` |
| **Entry point** | ~180 files across `app/api/*` and `lib/*` |
| **Controls** | Each file independently implements `company_id` scoping in its query logic — there is no database-level backstop once the service-role client is in play (RLS is bypassed by design for these paths). |
| **Status** | **Structurally correct but unverified at scale.** |
| **RISK** | No automated tests verify any of these 180 files' auth/scoping logic. Correctness depends entirely on every individual file getting the `company_id` filter right, forever, with no safety net if one is missed in a future edit. This is the single largest latent-risk surface in the app — a single missed `.eq('company_id', ...)` in any of these files is a full cross-tenant data leak with no RLS to catch it. |

> ASSUMPTION: Given the volume (180 files), this pass validated the pattern and spot-checked representative files rather than reading all 180 line-by-line. Treat TB-6 as "pattern verified, not exhaustively verified."

### TB-7: Anon → Public Mutation (proposal actions)
| | |
|---|---|
| **Actors** | Unauthenticated proposal recipients |
| **Entry point** | `POST /api/proposals/share/[token]/action` (`accept` / `decline` / `request_revision` / `view`) |
| **Controls** | Token-scoped; writes are performed server-side with the service-role client after token resolution — the anon Supabase client itself has no INSERT/UPDATE grants on proposals/views tables, so this is the only legitimate write path from the public side. |
| **Status** | **Verified — correct.** |

### TB-8: OAuth2 Clients
| | |
|---|---|
| **Actors** | Third-party OAuth2 clients (Looker Studio connector, and future Zapier/Make-style integrations) |
| **Entry point** | `/oauth/authorize`, `/api/oauth/{approve,token,clients/validate}` |
| **Controls** | PKCE (S256) enforced for public clients. Exact `redirect_uri` match against a per-client allowlist (no partial/prefix matching). Constant-time comparison for client secrets. Auth codes are single-use, enforced via an atomic `UPDATE ... WHERE consumed_at IS NULL`, with a 120-second expiry. Access and refresh tokens are stored only as SHA-256 hashes — a database read never yields a usable token. |
| **Status** | **Verified — textbook implementation.** No changes recommended. |

---

## 3. Threat Actors

| Actor | Motivation | Access level | Primary boundaries at risk |
|---|---|---|---|
| Opportunistic external attacker | Data theft, credential stuffing, defacement | None (internet) | TB-2, TB-7, public endpoints, TB-8 |
| Malicious/curious agency client (guest) | Access another client's data, view internal review stages | Holds one valid share token | TB-2 |
| Malicious/compromised agency team member (Member role) | Privilege escalation within their own company, or cross-tenant access if a scoping bug exists | Valid Bearer token, Member role | TB-1, TB-6 |
| Malicious/compromised MCP API key holder | Same as above, via the MCP surface; SSRF pivot to internal network | Valid MCP API key | TB-5 |
| Compromised third-party integration (Stripe/Resend/Meta impersonation) | Inject fraudulent billing events, phish via forged webhooks | Network position or leaked signing secret | TB-3, TB-4 |
| Insider with service-role/DB access | Full data access (out of scope for app-layer mitigation, noted for completeness) | Infra-level | All (bypasses app entirely) |

> ASSUMPTION: "Malicious agency client" is treated as the most realistic and highest-value threat actor for this product, since every company's clients are, by definition, semi-trusted outsiders with a real (if scoped) credential. TB-2 controls should be held to the highest bar accordingly.

---

## 4. Attack Surface

- **Public HTTP surface:** 6 public token-scoped viewer route families + their API routes, `/api/proposals/share/[token]/action`, OAuth2 endpoints, Stripe/Resend webhooks, public branding endpoint, signup/login/forgot-password flows.
- **Authenticated HTTP surface:** 122 API routes behind `getAuthContext`.
- **MCP surface:** 75 tool handlers with a separate auth implementation.
- **Third-party inbound:** Stripe webhook, Resend webhook (unaudited), Meta OAuth callback.
- **Third-party outbound:** outbound webhook dispatch to customer-configured URLs (SSRF-guarded per `lib/notification-webhooks.ts` pattern — `isValidWebhookUrl`), Meta Graph API calls, Resend send calls.
- **File upload surface:** company logo upload, `ProfileEditor`, `CoverEditor`, `TaskModal` client-side uploads, `upload_proposal_file` MCP tool (URL-fetch based).
- **Data layer:** Supabase Postgres with RLS as the primary backstop for 300+ authenticated paths, but no backstop at all for the 180 service-role files (TB-6).

---

## 5. Known Vulnerabilities

Findings from the audit, in descending severity. Each maps to the trust boundary/attack-surface section above.

### HIGH

**1. SSRF in `campaigns/scan-site`**
The route fetches a user-supplied URL server-side without running it through `isValidWebhookUrl` (the SSRF guard already used elsewhere, e.g. outbound webhook dispatch). This allows requests to `169.254.169.254` (cloud metadata endpoint) and other internal/private addresses, potentially exposing Vercel/cloud credentials or enabling internal network reconnaissance.
*Fix:* apply the existing `isValidWebhookUrl` guard (or equivalent allowlist/DNS-rebinding-safe check) before the fetch, consistent with how outbound webhooks already do it.

**2. HMAC signing key = Supabase service role key**
Using the service-role key as the HMAC signing secret couples two unrelated blast radii: compromise of the HMAC secret (e.g. via a signature-verification bug or log leak) is equivalent to compromise of the full database bypass key, and vice versa.
*Fix:* generate and store a dedicated `WEBHOOK_SIGNING_KEY` (or similarly scoped secret), independent from `SUPABASE_SERVICE_ROLE_KEY`. Rotate the signing key without needing to rotate DB access, and rotate DB access without invalidating webhook signatures.

### MEDIUM

**3. SSRF in MCP `upload_proposal_file` URL fetch** — same class as #1, different surface (TB-5). Fix: same guard, applied at the MCP tool-handler layer.

**4. IDOR in `ad-variations` POST** — `link_to_item_id` is accepted from the request without verifying the caller/company actually owns that item, allowing a user to link ad-copy variations to an item belonging to another company's campaign. Fix: verify `link_to_item_id` resolves to a row scoped to the caller's `company_id` before writing.

**5. CSP `unsafe-inline` for `script-src`** — weakens XSS defense-in-depth; if any injection point is missed elsewhere, CSP won't stop it. Fix: migrate to nonce- or hash-based script-src.

**6. `frame-src https: http:` wildcards** — overly permissive; allows framing/being-framed-by arbitrary origins over both HTTP and HTTPS. Fix: scope to the specific origins actually needed (Stripe, embeds, etc.).

**7. Rate limiter fail-open on `verify-password` and OAuth token endpoints** — the Postgres-backed sliding-window limiter is documented as fail-open by design (availability over strict enforcement), but on these two specific endpoints (password brute-force, token endpoint abuse) fail-open removes the only brute-force defense during a rate-limit-service outage. Fix: consider fail-closed (or a tighter fallback limit) specifically for these two endpoints, even though fail-open is the right default elsewhere.

**8. Company logo: unsanitized extension + SVG stored XSS** — uploaded SVGs are not sanitized before storage/serving, and file extensions aren't validated against actual content type, allowing a stored-XSS payload disguised as a logo. Fix: run uploaded SVGs through the existing DOMPurify pipeline (already used for `dangerouslySetInnerHTML` elsewhere) before storage, or disallow SVG and rasterize/convert on upload; validate extension against sniffed MIME type.

**9. Client-side uploads bypass server validation (`ProfileEditor`, `CoverEditor`, `TaskModal`)** — these components upload directly without a server-side validation pass (size/type/content checks), inconsistent with other upload paths in the app. Fix: route through the same server-side validation used elsewhere, or add equivalent checks before/at the storage write.

### LOW

**10. Protocol-relative open redirect** — a redirect check using `startsWith('/')` treats `//evil.com` as a valid relative path, but browsers interpret `//` as protocol-relative, redirecting off-site. Fix: reject any target starting with `//` in addition to requiring a leading `/`.

**11. Public branding endpoint allows company enumeration by UUID** — an unauthenticated endpoint returning branding data for any valid company UUID lets an attacker enumerate/confirm which company IDs exist. Low impact (no sensitive data returned) but worth noting. Fix: rate-limit more tightly, or accept only via an indirect/opaque lookup rather than raw UUID iteration risk (UUIDs aren't practically enumerable by brute force, so this is mostly theoretical unless UUIDs leak elsewhere).

**12. `get_funnel_data` missing inline `search_path`** — matches the documented Postgres gotcha (`SET search_path = ''` / missing `search_path` breaks or weakens SECURITY DEFINER functions). Fix: add `SET search_path = 'public'` to the function definition, consistent with the project's own documented convention.

---

## 6. Verified Security Controls

Controls confirmed present and correctly implemented during this audit, not requiring remediation:

- **No SQL injection** — all queries go through the Supabase query builder or parameterized RPC calls; no raw string-concatenated SQL found.
- **No command injection** — no `child_process`/`exec`/`spawn` usage in the codebase.
- **XSS defense-in-depth** — DOMPurify with tight allowlists wraps every `dangerouslySetInnerHTML` call site.
- **SSRF protection on webhook dispatch** — `isValidWebhookUrl` is checked both at webhook creation and again at delivery time (defends against DNS-rebinding between the two). (Note: this same guard is *missing* on two other surfaces — findings #1 and #3 above.)
- **No mass assignment** — mutation routes use explicit allowlisted objects; `{...body}` spreads into DB writes were not found.
- **Secrets hygiene** — no hardcoded secrets found; `.env` is properly gitignored.
- **Security headers** — HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` are all set (though see finding #6 for one header that's over-permissive).
- **Rate limiting** — Postgres-backed sliding-window limiter is wired into auth, AI-generation, notification, and public-viewer endpoints (see finding #7 for two endpoints where fail-open is a concern).
- **Meta token encryption** — AES-256-GCM with a random IV per encryption and auth-tag verification on decrypt.

---

## 7. Residual Risk

Even after the fixes in Section 5 are applied, the following risks remain structural to the current architecture and should be consciously accepted or addressed by design change, not a one-line patch:

- **TB-6 has no database backstop.** RLS is bypassed by design for 180 files; correctness is 100% dependent on application code getting `company_id` scoping right on every query, forever, with zero test coverage. This is the largest standing risk in the system — not because a bug is currently known, but because nothing would catch one. A single future PR that forgets a `.eq('company_id', ...)` filter in a service-role path is a full cross-tenant data leak, silently, with no RLS layer to fail closed.
- **TB-5's auth path is a fork, not a shared library.** Every future improvement to `lib/api-auth.ts` (rate limiting changes, token revocation, new role logic) requires a second, manual port into the MCP server's `getAuth`, or the two diverge further. This is a maintenance-driven security risk, not just a point-in-time bug.
- **TB-2's cookie lifetime is decoupled from share-link lifetime.** Even after any password-check fix, a guest's authenticated session for a share link isn't guaranteed to die when the link expires or the password rotates, unless this is explicitly re-architected (not just patched).
- **TB-4 is an unknown.** Until Resend webhooks (if any exist) are audited, there's an unquantified gap — could be nothing (no inbound webhooks in use) or could be equivalent to TB-3 before its controls were verified.
- **Fail-open rate limiting is a deliberate availability/security tradeoff.** It's correct for most endpoints but should be revisited endpoint-by-endpoint (see #7) rather than treated as a single global policy.

> ASSUMPTION: No customer data has been exposed via any of the HIGH findings to date — this document assumes the findings represent latent risk discovered proactively, not evidence of active exploitation. If there's reason to believe otherwise, this should trigger an incident response process rather than a routine fix cycle.

---

## 8. Recommendations

**Immediate (before next deploy touching these areas):**
1. Apply `isValidWebhookUrl` (or equivalent) to `campaigns/scan-site` and the MCP `upload_proposal_file` fetch — findings #1 and #3.
2. Rotate the HMAC signing key off the Supabase service-role key — finding #2.
3. Add ownership verification to `ad-variations` POST for `link_to_item_id` — finding #4.

**Near-term:**
4. Sanitize/reject SVG uploads for company logos through the existing DOMPurify pipeline — finding #8.
5. Route `ProfileEditor`, `CoverEditor`, `TaskModal` uploads through server-side validation — finding #9.
6. Tighten CSP `script-src` (remove `unsafe-inline`) and `frame-src` (remove wildcards) — findings #5, #6.
7. Fix the protocol-relative redirect check — finding #10.
8. Add `SET search_path = 'public'` to `get_funnel_data` — finding #12.

**Structural (design-level, plan before implementing):**
9. Audit TB-4 (Resend webhooks) to the same standard as TB-3.
10. Add server-side expiry enforcement to the share-auth cookie, tied to `share_expires_at` and password rotation — TB-2.
11. Establish automated tests (or at minimum a lint/codemod check) verifying `company_id` scoping across the 180 TB-6 service-role files — this is the highest-leverage structural fix in this document.
12. Converge the MCP server's `getAuth` onto `lib/api-auth.ts`, or explicitly document and monitor the fork so future auth changes are ported deliberately rather than accidentally forgotten — TB-5.
13. Revisit fail-open rate limiting specifically for `verify-password` and OAuth token endpoints — finding #7.

> ASSUMPTION: Recommendation priority above is ordered by (severity × ease of fix), not strictly by the HIGH/MEDIUM/LOW labels in Section 5 — items 9–13 are lower severity individually but higher long-term leverage, so they're called out separately as structural work rather than being ranked against the quick patches.
