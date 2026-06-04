---
target: app/campaigns/[id]
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-06-04T07-25-09Z
slug: app-campaigns-id
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading spinners present, toast confirmations work, but no skeleton states; status transitions on kanban drag lack a progress indicator during the API call |
| 2 | Match System / Real World | 3 | Terminology is clear ("Assets", "Kanban", "Board"), minor confusion: "Setup" tab is only relevant for webpage projects, "Members" tab is labeled with a Bell icon |
| 3 | User Control and Freedom | 2 | No undo on Kanban drag (status change is immediate + optimistic), no undo on comment resolve/delete beyond the confirm dialog, no way to cancel a due-date save mid-flight |
| 4 | Consistency and Standards | 2 | Settings and Setup pages use a different header pattern (inline back arrow + ProjectTabs) than the main tabs (FeedbackProjectHeader); the Setup page conditionally shows "Setup" tab only when hasWebpages is true |
| 5 | Error Prevention | 3 | Confirm dialogs on delete, URL validation on edit, but no confirmation on kanban drag to terminal states (approved/rejected/archived), sending a reminder to all guests has no "are you sure?" gate |
| 6 | Recognition Rather Than Recall | 3 | Tab navigation is clear, status colors are consistent, but the Comments page's priority filter uses small icon-only buttons |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts anywhere, no batch operations, no multi-select on kanban or assets, no command palette |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and purposeful; minor noise from the FeedbackProjectHeader action bar which packs 4-5 buttons |
| 9 | Error Recovery | 2 | Errors show toast messages but they're generic ("Failed to update status"); no inline recovery suggestions, comment deletion is irreversible |
| 10 | Help and Documentation | 1 | No contextual help, no tooltips explaining what stages mean, no guidance for first-time users |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM Assessment**: Clean. No AI slop detected. Functional, consistent, authored product UI. No gradient text, glassmorphism, hero-metric templates, eyebrow scaffolding, or identical card grids.

**Deterministic Scan**: Exit code 0 — zero findings across 90+ files.

**Verdict**: Not AI-generated.

## Overall Impression

Solid foundational UX with well-considered information architecture. The six-tab structure covers the full campaign workflow. Kanban drag-and-drop, per-stage assignees, and comment threading work together coherently. The biggest gap is efficiency and control — power users have no accelerators, and there are consistency breaks between page headers.

## What's Working

1. **Kanban Board execution.** Drag-and-drop with optimistic updates, per-stage assignees with avatar stacks, comment count badges, and decision tallies create a dense, information-rich board.
2. **Comments page two-column layout.** The 55/45 split between comment threads and tasks panel is a good use of screen real estate with priority filtering, tabs, and task badges.
3. **Consistent design token usage.** Semantic tokens used consistently across all pages with proper Button primitive deployment.

## Priority Issues

**[P1] Header inconsistency between main tabs and sub-pages**: Settings and Setup pages use a different header pattern than Kanban/Board/Assets/Comments, causing layout shifts when navigating between tabs.
Fix: Extract a single header component with optional actions slot.
Suggested command: /impeccable layout app/campaigns/[id]

**[P1] Tasks panel invisible below lg breakpoint**: The tasks panel uses hidden lg:block, invisible on 1024px screens.
Fix: Lower breakpoint or add toggleable drawer.
Suggested command: /impeccable adapt app/campaigns/[id]/comments

**[P2] No keyboard navigation on Kanban board**: Cards lack ARIA attributes and keyboard-based status change.
Fix: Add keyboard listeners or "Move to…" dropdown.
Suggested command: /impeccable harden app/campaigns/[id]/kanban

**[P2] Send Reminder has no confirmation**: Fires immediately, sends real emails with no gate.
Fix: Add confirm() dialog.
Suggested command: /impeccable harden app/campaigns/[id]/settings

**[P3] Priority filter icon sizing**: 12px icons on filter buttons are too small.
Fix: Bump to 14px.
Suggested command: /impeccable polish app/campaigns/[id]/comments

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts, no batch operations, no column-level actions, significant repetitive-click overhead for scaled workflows.
**Sam (Accessibility)**: Kanban drag handles lack ARIA attributes, TaskRow divs are keyboard-invisible, focus indicators rely on browser defaults.
**Riley (Stress Tester)**: No virtualization for large item sets, N+1 comment queries on assets grid, no draft persistence for replies.

## Minor Observations

- ProjectTabs "Members" tab uses Bell icon instead of Users icon
- Setup page polls every 5s with no visual polling indicator
- FeedbackItemCard fires individual comment stat queries (N+1)
- handleShare uses deprecated document.execCommand('copy') fallback
- Asset detail viewer fires 6 parallel fetches on mount

## Questions to Consider

- What if the Kanban board had a compact density mode for 50+ asset campaigns?
- What would this look like with real-time collaboration (Supabase real-time subscriptions)?
- Does the comments tab justify being standalone, or could it be a view within item detail?
