---
target: app/dashboard/page.tsx
total_score: 25
p0_count: 1
p1_count: 2
timestamp: 2026-06-03T12-01-01Z
slug: app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading states are text strings, not skeleton placeholders |
| 2 | Match System / Real World | 3 | "Feedback" badge should say "Campaign" per naming convention |
| 3 | User Control and Freedom | 2 | "Reply & resolve" is forced compound action; no reply-only option |
| 4 | Consistency and Standards | 3 | Inconsistent drag instruction placement between kanbans |
| 5 | Error Prevention | 2 | Reply auto-resolves with no confirmation |
| 6 | Recognition Rather Than Recall | 3 | Drag instructions are text-only, easily missed |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no bulk triage, inbox capped at 8 |
| 8 | Aesthetic and Minimalist Design | 2 | Two 520px kanbans duplicate existing pages |
| 9 | Error Recovery | 3 | No undo after resolve/dismiss |
| 10 | Help and Documentation | 2 | Tour replay tiny/faint; no first-run guidance |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

LLM: Concern. Hero-metric template in client view, uppercase tracked eyebrows, decorative entrance animation. Detector: Clean (0 findings). Both agree no mechanical anti-patterns; concerns are compositional.

## Priority Issues

[P0] "Reply & resolve" forced compound action (InboxItem.tsx:219). No reply-without-resolving option.
[P1] Two 520px kanbans create 1800px scroll. Dashboard duplicates existing pages.
[P1] Campaigns section bundles inbox (reactive triage) and kanban (proactive management) in one card.
[P2] Keyboard accessibility gaps: lightbox missing focus trap, dialog role, Escape handler. Hover-only menus.
[P3] Inconsistent drag instruction placement and token usage between sections.

## Persona Red Flags

Alex: Inbox cap at 8 with no "View all" link. No bulk triage. No filtering on kanbans.
Sam: Lightbox a11y gaps. Hover-only menus. No time elements. Missing aria-hidden on icons.
Jordan: Four stacked empty states on first load. "Inbox zero" misleading for new accounts. Tour replay button too subtle.

## Minor Observations

- text-[28px] not a token
- "Feedback" badge should say "Campaign"
- Loading states are plain text, not skeletons
- Scrollbar thumb #333 one-size-fits-all
- Icon container border-radius inconsistency
