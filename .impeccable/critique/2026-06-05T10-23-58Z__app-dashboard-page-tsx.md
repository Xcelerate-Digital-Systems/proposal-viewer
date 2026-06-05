---
target: dashboard
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-06-05T10-23-58Z
slug: app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good skeletons and undo toast, but no confirmation feedback after sending a reply (form just closes) |
| 2 | Match System / Real World | 3 | Clear terminology throughout; "Agency Activity" slightly vague for an email log |
| 3 | User Control and Freedom | 3 | Excellent undo-on-resolve (5s window); lightbox supports Escape; no undo on sent replies |
| 4 | Consistency and Standards | 3 | Consistent card vocabulary; raw `<button>` elements used instead of `<Button>` primitive in InboxItem |
| 5 | Error Prevention | 2 | No autosave on draft replies — typed text lost if user clicks away; resolve has undo but no confirmation |
| 6 | Recognition Rather Than Recall | 3 | Icons paired with text labels; pipeline legends are clear; no tooltips on widget headers |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, no bulk resolve, no inbox search/filter, single workflow path |
| 8 | Aesthetic and Minimalist Design | 3 | Clean hierarchy, focused layout; sidebar widget stack (5 cards) risks pushing content below fold |
| 9 | Error Recovery | 2 | Reply errors show inline; reply-thread fetch fails silently (catch block empty) |
| 10 | Help and Documentation | 2 | Tour replay exists; no contextual help or tooltips explaining widget scope |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: The dashboard avoids common AI slop tells. No gradient text, no glassmorphism, no eyebrow kickers, no hero-metric template. The layout is a genuine two-column task-oriented workspace, not a generic SaaS dashboard template. The card vocabulary is consistent and earned. One borderline note: the reply thread uses `border-l-2` as an indent marker (InboxItem.tsx:235) — this is a standard nested-reply convention, not a decorative accent stripe.

**Deterministic scan**: Clean. The detector found 0 anti-pattern violations across all dashboard files.

## Overall Impression

This is a solid, task-oriented dashboard that gets the information architecture right: actionable inbox on the left, status summaries on the right. The undo-on-resolve pattern is a standout. The biggest opportunity is efficiency — a power user managing 20+ client comments has no keyboard shortcuts, no bulk operations, and no way to filter or search the inbox. The right sidebar also stacks too many widgets vertically, pushing the email activity widget off-screen on most viewports.

## What's Working

1. **Undo-on-resolve pattern** (page.tsx:164-189): Optimistic removal with a 5-second undo window and cleanup-on-unmount. This is textbook good UX for a repetitive triage workflow.

2. **Aging indicator on stale comments** (InboxItem.tsx:93,160): Comments older than 48 hours get a subtle amber background wash, surfacing neglected items without being aggressive. The timestamp also switches to amber text.

3. **Consistent card structure**: Every widget follows the same pattern — white card, rounded-2xl, shadow-card, px-5 py-4 header with icon + title + count, border-b divider. This gives the dashboard coherence without a rigid grid.

## Priority Issues

### [P1] No keyboard efficiency path
**What**: The entire inbox interaction requires mouse clicks. No keyboard shortcuts for Reply (R), Resolve (D), Next item (J/K), or bulk resolve.
**Why it matters**: Agency account managers triaging 15-20 comments daily are stuck clicking through each one. This is the dashboard's primary task, and it has zero accelerators.
**Fix**: Add keyboard shortcuts (J/K to navigate items, R to reply, D to resolve, Esc to cancel). Show shortcut hints on hover.
**Suggested command**: `/impeccable harden dashboard` (keyboard nav is a production-readiness gap)

### [P2] Reply button hover state is broken
**What**: The Reply button (InboxItem.tsx:325) has `bg-surface hover:bg-surface` — hover produces no visual change. The button appears non-interactive on hover.
**Why it matters**: Broken hover feedback violates basic affordance expectations. Users hesitate when a button doesn't respond to hover.
**Fix**: Change to `bg-surface hover:bg-edge` or `hover:bg-edge-strong` for visible feedback.
**Suggested command**: `/impeccable polish dashboard`

### [P2] Right sidebar widget overload
**What**: The sidebar stacks up to 5 cards (Awaiting My Review, Needs New Version, Campaigns pipeline, Proposals pipeline, Email Activity). On a 900px-tall viewport, the bottom 1-2 widgets are below the fold.
**Why it matters**: Email Activity — the only widget showing delivery status for sent proposals — is always last and likely never seen without scrolling.
**Fix**: Consider collapsing the two pipeline summaries into a single card with tabs, or making the sidebar independently scrollable with `overflow-y-auto` and a max height.
**Suggested command**: `/impeccable layout dashboard`

### [P2] Silent failure on reply-thread fetch
**What**: InboxItem.tsx:140-141 catches errors on reply loading with an empty block. If the fetch fails, the "replies" section shows nothing with no feedback.
**Why it matters**: The user clicked to expand replies and gets a blank space. No error, no retry affordance, no indication that something went wrong.
**Fix**: Add an error state inside the replies panel with a "Failed to load — try again" link.
**Suggested command**: `/impeccable harden dashboard`

### [P1] Draft reply text lost on accidental navigation
**What**: If a user types a reply and clicks "Open" (which navigates to the asset), or accidentally clicks outside, the reply text is lost. No autosave, no "discard unsaved reply?" confirmation.
**Why it matters**: Losing a half-written reply is high-frustration, especially when the user just spent time composing feedback.
**Fix**: Store draft text in component state keyed by commentId (sessionStorage or local state). Warn before navigating away with an unsaved reply.
**Suggested command**: `/impeccable harden dashboard`

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts for the primary triage workflow. Cannot bulk-resolve multiple comments. No command palette or quick-jump. The 10-item inbox cap with a "View all" link forces a context switch to `/campaigns` for heavy triage sessions. High friction for daily power use.

**Sam (Accessibility-Dependent User)**: Reply and Resolve action buttons lack visible focus indicators (no `focus:ring-*` classes). The aging indicator uses color alone (amber background) with no icon or text label — a screen reader user would miss the urgency signal. The lightbox properly traps focus (good), but the undo toast has no `role="status"` or `aria-live` announcement.

**Agency Account Manager "Morgan"** (project-specific): Manages 3-4 active campaigns with 5-10 client stakeholders. Checks the dashboard first thing each morning to prioritize responses. The lack of filtering (by campaign, by client, by age) means Morgan must scan every comment linearly. No way to star or pin high-priority comments for follow-up. The "Awaiting my review" widget is useful but disconnected from the inbox — items requiring review and items requiring reply are in separate widgets with no unified priority view.

## Minor Observations

- **Inbox item count badge** (page.tsx:335): The amber-500 badge count is small and could be missed. Consider using the `text-white bg-red-500` pattern for unresolved counts that need attention.
- **Email Activity widget title** "Agency Activity" is misleading — it only shows emails, not all agency activity. "Recent Emails" would be more accurate.
- **Client view stat cards**: The 4-card grid (Awaiting Review, Accepted, Proposals, Quotes) uses generic `FileText` icons for both Proposals and Quotes. Quotes should use `ReceiptText` to match the convention in ClientPipeline.
- **`formatRelative` is duplicated** in both InboxItem.tsx and EmailActivityWidget.tsx with slightly different locale settings (en-US vs en-AU).
- **The `text-teal` class** in ClientPipeline.tsx:72 doesn't match the semantic token vocabulary — it should be `text-primary`.

## Questions to Consider

- The inbox shows client comments and the sidebar shows review assignments. What if these were merged into a single prioritized "action feed" — would that reduce the cognitive load of checking two separate widgets?
- Is the 10-item inbox cap the right cutoff? If most agencies have fewer than 10 pending comments, the cap never triggers and the "View all" link is invisible. If they have 30+, showing only 10 without filters makes the dashboard feel incomplete.
- The dashboard greeting changes by time of day — is that earning its place? Would showing the count of items needing attention ("5 items need your attention") in the greeting line be more useful than "Good morning"?
