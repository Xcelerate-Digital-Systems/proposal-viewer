---
target: settings
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-06-05T10-19-46Z
slug: app-settings-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Save confirmation uses timed fade; no persistent dirty-state indicator on Company tab |
| 2 | Match System / Real World | 2 | Billing features list uses incorrect product terminology ("Creative Review", "AI-powered", "ad reporting") |
| 3 | User Control and Freedom | 3 | Good cancel/undo patterns; notification prefs toggle but no bulk reset |
| 4 | Consistency and Standards | 2 | Mix of inline `<button>` and `<Button>` primitive; inconsistent card rounding (14px vs 16px); action menus use `position: absolute` inside potential overflow containers |
| 5 | Error Prevention | 3 | Confirmation dialogs for destructive actions (revoke, remove); role change has no confirmation |
| 6 | Recognition Rather Than Recall | 3 | Good tab labels with icons; notification pref pills could benefit from a group label |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts for tab switching; no search/filter in Members; notification prefs are per-member only (no bulk) |
| 8 | Aesthetic and Minimalist Design | 3 | Clean layout; Developer tab well-organized with section cards; some description text at 12px/faint is low contrast |
| 9 | Error Recovery | 2 | Network errors shown inline (Billing) but silently swallowed elsewhere (Activity fetch catch, CompanyProfileCard save) |
| 10 | Help and Documentation | 1 | No contextual help; no tooltips on complex settings (quote number format, webhook signing); Roles tab mentions "contact us" with no link |
| **Total** | | **24/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: The settings page is clean and professional. No AI slop detected. The layout is functional, the tab navigation is standard, and the visual language is consistent with the rest of the app's product register. The Developer tab's section cards with icon headers are well-structured. No gradient text, no glassmorphism, no decorative motion, no eyebrow patterns.

**Deterministic scan**: Clean. Zero findings from `detect.mjs` across the settings page and all sub-components.

## Overall Impression

A solid, functional settings page that follows the product's restrained design language well. The biggest opportunity is **copy accuracy**: the Billing tab's feature list contradicts three hard product rules (AI claims, "Creative Review" naming, "ad reporting" framing). The second opportunity is **error handling consistency**: some tabs surface errors clearly while others silently fail.

## What's Working

1. **Tab architecture is clean.** URL-synced tabs with role-gated visibility is a good pattern. The left-rail navigation on desktop with horizontal scroll on smaller screens is practical.

2. **Developer tab organization.** The DeveloperSection component creates clear visual groupings for API keys, webhooks, and connected apps. The section header + description pattern gives context without clutter.

3. **Member row interaction density.** Avatar upload/remove on hover, inline name editing with conditional save button, notification pref toggles — all packed into a readable row without feeling cramped. The notification pills using teal/off states are scannable.

## Priority Issues

### [P0] Billing feature list contains three product-rule violations
**What**: [BillingTab.tsx:54](components/admin/settings/BillingTab.tsx#L54) lists "Creative Review" (old name), "AI-powered content generation" (violates no-AI rule), and "live ad reporting dashboards" (violates no-ad-reporting rule).
**Why it matters**: These are hard rules from CLAUDE.md. "Creative Review" should be "Campaigns". AI claims are explicitly banned. The Looker connector should be framed as "pipe data into Looker Studio", not "ad reporting dashboards".
**Fix**: Update `PLAN_FEATURES` array: rename "Creative Review" to "Campaigns", remove "AI-powered" from the content generation line or remove it entirely, reframe Looker as "Looker Studio Connector — sync ad platform data into your reports".
**Suggested command**: `/impeccable clarify`

### [P1] Inconsistent error handling across tabs
**What**: Billing tab shows error banners. Activity tab silently catches fetch errors. CompanyProfileCard and BusinessDetailsCard swallow save failures (no error state shown). ApiKeyManager shows no error state for failed creates/revokes.
**Why it matters**: Users performing admin actions (saving company details, managing API keys) get no feedback when something fails. They'll assume the action succeeded.
**Fix**: Add error state handling to CompanyProfileCard, BusinessDetailsCard, and ApiKeyManager. At minimum, show a toast on failure.
**Suggested command**: `/impeccable harden`

### [P1] Action menu uses `position: absolute` which clips inside overflow containers
**What**: [MembersTab.tsx:497](components/admin/settings/MembersTab.tsx#L497) renders the role/remove dropdown as `position: absolute` inside a `divide-y` container with `overflow-hidden`. The menu will be clipped if it extends below the container boundary.
**Why it matters**: For the last member in the list, the dropdown menu will be cut off or invisible.
**Fix**: Use a portal or `position: fixed` for the dropdown, or use the native popover API.
**Suggested command**: `/impeccable harden`

### [P2] Low contrast description text
**What**: `SectionHeader` uses `text-xs text-faint` for descriptions. `text-faint` is #8C8C8C on white (#FFFFFF), which is approximately 3.5:1 contrast — below the 4.5:1 WCAG AA requirement for small text.
**Why it matters**: Accessibility violation. The description text is informational, not decorative; it needs to be readable.
**Fix**: Change `text-faint` to `text-muted` (#6B7280) in SectionHeader descriptions and similar locations (DeveloperSection descriptions, webhook helper text).
**Suggested command**: `/impeccable audit`

### [P2] Role change has no confirmation dialog
**What**: [MembersTab.tsx:179-187](components/admin/settings/MembersTab.tsx#L179-L187) changes a member's role immediately on click with no confirmation. Removing a member has a confirm dialog, but promoting/demoting does not.
**Why it matters**: Accidentally making someone an Owner is a high-impact, hard-to-reverse action.
**Fix**: Add a confirmation dialog for role changes, especially for Owner promotion.
**Suggested command**: `/impeccable harden`

### [P2] Inline buttons not using Button primitive
**What**: Multiple inline `<button>` elements in MembersTab (name save, avatar actions, menu items, notification toggles), CompanyProfileCard, and the main settings nav. The project has a `<Button>` primitive but it's only used in BillingTab, ActivityTab, and the connector cards.
**Why it matters**: Inconsistent affordances across the settings surface. The Button primitive provides consistent sizing, focus rings, loading states, and disabled styling.
**Fix**: Migrate inline buttons to `<Button>` where appropriate, particularly the name save button and action menu items.
**Suggested command**: `/impeccable polish`

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts for tab navigation. Can't quickly jump between Members → Developer → Activity. The member list has no search or filter — with 15+ team members, finding a specific person requires scrolling. No bulk notification preference management (must expand each member individually).

**Sam (Accessibility-Dependent User)**: The notification preference pills are `<button>` elements with no aria-label — screen readers will read the icon component name, not the preference meaning. The avatar hover overlay (opacity transition from 0 to 1) gates interactive controls behind a mouse hover, making them inaccessible to keyboard users. The role dropdown menu has no focus trap or aria-expanded.

**Riley (Stress Tester)**: What happens when the CompanyProfileCard save silently fails? The user sees the "Saved" checkmark fade in from the timed state, but the data didn't persist. On refresh, the old values are back. The `justCreated` API key banner in ApiKeyManager persists across tab switches — if the user navigates away and back, is the plaintext key still visible? (It is, via React state.)

## Minor Observations

- The Roles tab header is rendered twice: once by `SectionHeader` would be expected but it's actually rendered inside the RolesTab component itself (line 35). The parent page doesn't wrap it in a SectionHeader, but this is inconsistent with how Members and Billing tabs work.
- The `text-2xs` class used in several places (role descriptions, filter labels) maps to 10px — the documented floor. Some instances like the role description text at `max-w-[120px]` may be too small to read comfortably in the permission matrix.
- The "Markup" internal terminology leaks into the UI: notification preference keys are labeled with the `markup_notify_*` prefix, and the preference group has no visible heading explaining what "Comments, Replies, Resolved, Status, New versions" refers to. A user unfamiliar with the Campaign system won't understand what these notification toggles control.
- Activity tab filter labels use `text-2xs font-medium text-muted uppercase tracking-wide` — this is the eyebrow pattern. It's acceptable here as form field labels (functional, not decorative section markers), but the uppercase styling adds visual noise to what should be a quiet filter bar.

## Questions to Consider

- Should notification preferences be collapsed by default and expanded on demand, rather than always visible for every member? With 10 members, that's 50 toggles on screen.
- The Developer and Integrations tabs are both gated behind `canSeeDeveloper` (admin/owner). Should Integrations have its own permission? A marketing lead might need to connect Meta without seeing API keys.
- The Roles tab is read-only with "contact us" as the escape hatch. Is a mailto link or support form link worth adding, or does the in-app support page cover this?

---

**Trend**: First run for this target, no trend yet.
