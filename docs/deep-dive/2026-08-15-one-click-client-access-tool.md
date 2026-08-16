# Deep Dive: One-Click Client Access Tool for AgencyViz

## Executive Summary

Building a one-click client access/onboarding tool is technically viable and strategically compelling for AgencyViz. The market is proven (Leadsie has operated since ~2020 with 1,000+ agencies), pricing supports $15-$299/mo tiers, and no platform has shut down a competitor. However, the real cost is not engineering — it is platform approvals. Meta App Review now takes ~20 days per cycle, Google requires CASA security audits, LinkedIn partner approval runs 3-4 months, and TikTok needs documented case studies before granting production access. The recommended approach is a phased MVP starting with Meta and Google (where AgencyViz already has OAuth infrastructure), treating platform approvals as the critical path, not code.

---

## Findings

### What the Market Looks Like

Five direct competitors operate in this space, none dominant enough to block entry:

| Tool | Integrations | Pricing Range | Differentiator |
|------|-------------|---------------|----------------|
| **Leadsie.io** | 31+ | $59-$299/mo | Market leader, broadest coverage, "Access Detective" audit |
| **Digital SERO** | 10+ | Free-$99/mo | Cheapest paid tier, simpler feature set |
| **Connexify** | 15+ | $45-$180/mo | Broadest platform coverage (Amazon, Klaviyo, GoDaddy) |
| **AgencyAccess** | 6+ | Free+ | Lean feature set, unclear traction |
| **OneClick Onboard** | Unknown | Free+ | Newest (2025), "80% of Leadsie at 20% cost" positioning |

No open-source solutions exist. Reporting tools (AgencyAnalytics, Whatagraph, GoHighLevel) pull data via OAuth but do not grant access — they are not competitors in this category.

**AgencyViz's differentiation opportunity:** None of these tools are embedded in a broader agency platform. They are all standalone products. AgencyViz could offer client access granting as a native feature within the existing client onboarding flow — the client clicks one link, grants platform access, and lands in their AgencyViz client portal with proposals, campaigns, and docs already waiting. That integrated experience does not exist today.

**Pricing benchmarks:** The market supports $15-$299/mo as a standalone product. As a bundled feature inside AgencyViz, it could justify a plan upgrade rather than a separate line item.

### Platform-by-Platform Technical Feasibility

#### Meta (Facebook/Instagram Ads, Pages)

- **API available:** Yes. `POST /<BUSINESS_ID>/client_ad_accounts` and `POST /<ASSET_ID>/agencies` with `permitted_tasks`.
- **Client interaction required:** Yes — HARD LIMIT. The receiving business must accept the request in Meta's UI. No API exists to auto-accept. Every competitor solves this the same way: a guided walkthrough of Meta's native acceptance screens.
- **Approval requirements:** `business_management` + `ads_management` with Advanced Access. Requires Business Verification + App Review (currently ~20 days per cycle). New "Marketing API Access Tier" model (May 2026) requires 500+ API calls in the trailing 15 days with <15% error rate before you can even apply — a bootstrap problem for a new feature.
- **AgencyViz advantage:** Already has Meta OAuth (`META_APP_ID`, `META_APP_SECRET`), token encryption (AES-256-GCM), and `meta_connections` table. The existing App Review approval for the Looker connector may or may not cover `business_management` scope — this needs verification.
- **Stability:** No deprecation of B2B/asset-sharing endpoints found. Stable on v26.0.

#### Google Ads

- **API available:** Yes. `CustomerClientLinkService` creates a PENDING link.
- **Client interaction required:** Yes — client must accept the link (via API or Google Ads UI).
- **Approval requirements:** `adwords` scope + separate Google Ads API developer token (Test → Basic → Standard tiers). Sensitive scope verification (3-10 business days clean, often weeks). CASA security audit required annually for restricted scopes.
- **Key constraint:** Developer token approval is a separate process from OAuth verification.

#### Google Analytics 4

- **API available:** Yes. `properties.accessBindings.create` — DIRECT GRANT, no client acceptance needed if the caller has admin access.
- **Client interaction required:** Only the initial OAuth consent to confirm admin access. No separate acceptance step.
- **Approval requirements:** `analytics.manage.users` (sensitive scope). Same verification timeline as above.

#### Google Tag Manager

- **API available:** Yes. `accounts.user_permissions.create` — DIRECT GRANT, same as GA4.
- **Client interaction required:** Only initial OAuth consent.
- **Approval requirements:** `tagmanager.manage.users` (sensitive scope).

#### Google Search Console

- **API available:** No confirmed API for adding users programmatically. Likely UI-only.
- **Workaround:** Guide client through manual addition, or skip in MVP.

#### TikTok

- **API available:** Yes, via Business Center API. Asset assignment endpoints exist for BC-owned assets.
- **Client interaction required:** Limited to BC-owned assets only — cross-BC work requires Partner status.
- **Approval requirements:** Sandbox → App Review → Production → Partner status. Partner review takes "several weeks" and requires documented case studies.
- **Verdict:** Not viable for MVP. Gate behind Partner approval timeline.

#### LinkedIn

- **API available:** Partially. `POST /rest/adAccountUsers` for ad account access requires `rw_ads` scope. Client and agency must already be "connected" (LinkedIn-specific prerequisite).
- **Client interaction required:** Yes, for the initial connection.
- **Approval requirements:** Partner Program approval: 4-8 weeks fast, 3-4 months typical. LinkedIn actively rejects apps perceived as "competitive tools" duplicating Campaign Manager.
- **Page admin access:** Unclear/unconfirmed via API.
- **Verdict:** High risk of rejection. Do not attempt in MVP.

#### WordPress

- **API available:** No. WordPress has no native OAuth server or access delegation API. Application Passwords (WP 5.6+) are for REST API authentication, not user-role delegation.
- **How competitors do it:** Leadsie deep-links the client into `wp-admin/user-new.php` with plain-language instructions (enter agency email, select Administrator role, click "Add New User"). It's a guided manual flow, not programmatic.
- **WordPress.com vs self-hosted:** WordPress.com has its own invite system (Settings → People → Invite) tied to WordPress.com accounts. Self-hosted sites use the local user database — every site needs a separate invite.
- **Plugins that help:** Simple Client Dashboard (limited admin role), Controlled Admin Access (temporary admin with auto-expiry), Advanced Access Manager (capability scoping). None provide true one-click delegation.
- **Verdict:** Include in MVP as a guided flow. Low engineering cost (deep-link + instructions + self-reported confirmation). No approval gates.

#### Pinterest / Snapchat / X

- **Pinterest:** Business Access API exists for programmatic sharing. Lower priority but technically feasible.
- **Snapchat:** Marketing API has Organization/Ad Account role endpoints, BUT the API was closed to new partners in 2026.
- **X (Twitter):** Hybrid — UI-driven initial grant, then API management. Low priority for agencies.

### Risks and Blockers

**Critical (could block launch):**

1. **Meta App Review bootstrap problem.** The new Marketing API Access Tier requires 500+ API calls in the trailing 15 days before you can apply for Advanced Access. A new feature with zero traffic cannot meet this threshold. Mitigation: leverage existing Meta OAuth approval if scopes overlap, or stage calls through the Looker connector flow.

2. **Google CASA security audit.** Annual requirement for sensitive/restricted scopes. Cost and timeline vary. This is a recurring operational burden, not a one-time gate.

3. **Meta "accept in UI" hard limit.** No API workaround exists. The product UX must include a guided walkthrough of Meta's native screens — this is not a simple OAuth redirect. All competitors do this; it is solvable but adds UX complexity.

**High (significant effort or delay):**

4. **Platform approval timelines.** Meta ~20 days, Google 3-10+ days, TikTok weeks, LinkedIn 3-4 months. These run sequentially per platform and rejections restart the clock. Total time to full platform coverage: 3-6 months minimum.

5. **Token security liability.** Holding refresh tokens for many client accounts across multiple platforms creates a high-value breach target. Requires encrypted storage (already have this for Meta), access logging, and potentially SOC 2 / security certification to satisfy enterprise agency clients.

**Medium (manageable but worth noting):**

6. **Ongoing compliance.** Annual CASA recerts, Meta re-verification on API version bumps, LinkedIn capacity freezes. This is not a "build and forget" feature.

7. **No shutdown precedent — but no guarantee.** Leadsie has operated since ~2020 without platform action. Platforms tolerate the category today. This could change, but the risk is low given the 6+ year track record.

### MVP Recommendation

**Platforms for MVP:** Meta + Google (Ads, GA4, GTM) + WordPress (guided flow).

| Platform | Mechanism | Client Step | Approval Gate |
|----------|-----------|-------------|---------------|
| **Meta** (Ads, Pages) | OAuth → API request → client accepts in Meta UI | Must click "Accept" in Business Suite | `business_management` Advanced Access (~20 days) |
| **Google GA4** | OAuth → direct API grant | OAuth consent only | `analytics.manage.users` sensitive scope (3-10 days) |
| **Google GTM** | OAuth → direct API grant | OAuth consent only | `tagmanager.manage.users` sensitive scope (same review) |
| **Google Ads** | OAuth → API creates PENDING link → client accepts | Must accept in Google Ads UI or via API | `adwords` scope + developer token (Test → Basic → Standard) |
| **WordPress** | Guided deep-link to wp-admin "Add User" | Manual — adds agency as WP user | None (no API involved) |

Skip TikTok, LinkedIn, Pinterest, Snapchat entirely.

**Why include Google Ads despite the extra gate:** Google Ads is the highest-value platform after Meta for most agencies. The developer token approval runs in parallel with other approvals. The MCC linking flow mirrors Meta's pattern (agency sends request, client accepts), so the UX is consistent. Start the developer token application immediately alongside other approvals.

**WordPress approach:** No WordPress API exists for access delegation — even Leadsie uses a guided manual flow. The client clicks a deep-link that drops them into wp-admin's Users → Add New screen with clear instructions (agency email, Administrator role). The access page confirms completion when the client clicks "Done." This is low-engineering-cost and covers a common agency need.

**MVP feature set:**

1. Agency creates a "Client Access Request" from the client management page (`/clients/[id]`), selecting which platforms to request.
2. System generates a branded link (using company branding from existing `company_branding` table).
3. Client clicks link, hits a public page (`/access/[token]`) showing a checklist of platforms to connect.
4. For GA4/GTM: standard OAuth flow → direct grant via API. Check mark, done.
5. For Meta: OAuth flow → guided walkthrough of Meta's native acceptance screen with screenshots/instructions.
6. For Google Ads: OAuth flow → MCC link request sent → client guided to accept in Google Ads UI (or auto-accepted via API if client's OAuth token has sufficient access).
7. For WordPress: deep-link to client's wp-admin/user-new.php with pre-filled instructions → client adds agency user manually → clicks "Done" to confirm.
8. Agency dashboard shows status per client per platform (connected/pending/manual-confirmed/failed).

**Architecture:**

- New tables: `client_access_requests` (company_id, client_id, share_token, status, platforms_requested), `client_access_grants` (request_id, platform, grant_type [oauth|guided], status, granted_at, token_encrypted, wp_site_url).
- New API routes under `/api/client-access/`.
- Public viewer at `/access/[token]` — follows the existing pattern of `/view/[token]` (proposals) and `/doc/[token]` (documents). Must be mobile-responsive (clients receive these links on mobile).
- Reuse existing Meta OAuth flow from `lib/connectors/meta/`. Extend for Google scopes.
- Token storage in Supabase with existing AES-256-GCM encryption pattern.
- WordPress grants are self-reported (client confirms they added the user) — no token stored.

**Timeline estimate:**

- Platform approvals (critical path): 4-8 weeks for Meta scope extension + Google sensitive scope verification + Google Ads developer token. Start ALL applications immediately.
- Engineering (parallel with approvals): 4-5 weeks for MVP (branded link, public access page, GA4/GTM direct grants, Meta guided flow, Google Ads MCC linking, WordPress guided flow, status dashboard).
- Total: 6-10 weeks to launchable MVP, assuming no approval rejections.

### Revenue Model

Three viable approaches, in order of recommendation:

1. **Bundle into higher plan tiers.** Add "Client Access Requests" as a gated resource in the `plans` table (like proposals, documents, reviews). Free tier: 0. Growth tier: 5/mo. Pro tier: unlimited. This drives plan upgrades without fragmenting the product. Fits the existing `checkResource()` entitlement pattern.

2. **Add-on module.** $29-$49/mo add-on to any plan. Simpler to price but adds billing complexity (Stripe line items).

3. **Usage-based.** Per-onboarding fee ($3-$5 per client access request). Aligns cost with value but unpredictable revenue.

Recommendation: Option 1. The feature is most valuable as a retention/upgrade driver, not a standalone revenue line. Agencies evaluating AgencyViz vs. competitors will see "client onboarding built in" as a differentiator that justifies a higher-tier plan. Leadsie charges $59-$299/mo for this alone — bundling it into a $99-$199/mo AgencyViz plan makes the platform look like a bargain.

### Architecture Fit with AgencyViz

The existing codebase is well-positioned for this feature:

- **Meta OAuth already exists.** `lib/connectors/meta/` has OAuth flow, token encryption (AES-256-GCM via `token-crypto.ts`), and `meta_connections` table. The question is whether the existing App's approved scopes include `business_management`.
- **Multi-tenant isolation is built.** All data tables are `company_id`-scoped with RLS. New `client_access_*` tables follow the same pattern.
- **Client management exists.** `/clients` page with client CRUD. The access request flow attaches naturally to a client record.
- **Public viewer pattern is established.** `/view/[token]`, `/doc/[token]`, `/review/[token]` all use share tokens for unauthenticated access. `/access/[token]` follows the same pattern.
- **Branding/white-label is built.** `company_branding` table + `useCompanyBranding` hook. The public access page can use agency branding out of the box.
- **Entitlements/gating is built.** `lib/billing/entitlements.ts` with `checkResource()`. Adding a new resource type is a plan table update + one new check.
- **Rate limiting is built.** `lib/rate-limit.ts` with Postgres-backed sliding window. Apply to the public access endpoint.

No major architectural changes needed. This is a new feature module, not a platform rewrite.

---

## Open Questions

1. **Does the existing Meta App's approval cover `business_management` scope?** If not, a new App Review submission is needed — adding 20+ days to the timeline.
2. **What is the actual cost and timeline for a CASA security audit?** Required for Google sensitive scopes, recurs annually. Need to get a quote.
3. **Can the 500-call Meta bootstrap requirement be met through existing Looker connector traffic?** If the same App ID is used, existing API calls may count toward the threshold.
4. **Google Ads developer token — which tier is needed?** Basic access may suffice for MCC linking. Standard access has a longer review. Clarify before applying.
5. **Is white-label/custom subdomain worth building in MVP?** Leadsie charges $129/mo+ for it. AgencyViz already has custom domain support — extending it to the access page may be low effort.
6. **What happens when a client's OAuth token expires or is revoked?** Need a monitoring/alerting pattern — agencies need to know when access breaks.
7. **Legal/privacy implications of holding third-party platform tokens on behalf of clients.** May need updated Terms of Service and a data processing agreement.
8. **WordPress: should we build a lightweight WP plugin?** A companion plugin that auto-creates the agency user account on install would remove the manual step. Low complexity but adds a WP plugin maintenance burden. Evaluate after MVP based on adoption.

---

## Sources

- Leadsie.io — product pages, pricing, integration list
- Digital SERO (digitalsero.com) — product pages, pricing
- AgencyAccess (agencyaccess.co) — product overview
- Connexify (connexify.io) — product pages, pricing, AppSumo listing
- OneClick Onboard (oneclickonboard.com) — product positioning
- Meta Business SDK documentation — Business-to-Business APIs, asset sharing endpoints
- Meta App Review documentation — Advanced Access requirements, Marketing API Access Tier (May 2026)
- Google Ads API documentation — CustomerClientLinkService, developer token tiers
- Google Analytics Admin API documentation — accessBindings endpoints
- Google Tag Manager API documentation — user_permissions endpoints
- Google OAuth verification documentation — sensitive scope verification, CASA audit requirements
- TikTok Business Center API documentation — asset assignment, partner review process
- LinkedIn Marketing API documentation — adAccountUsers endpoint, Partner Program
- Pinterest Business Access API documentation
- Snapchat Marketing API documentation (closed to new partners 2026)
