---
target: campaign feedback
total_score: 28
p0_count: 2
p1_count: 2
timestamp: 2026-06-07T04-39-09Z
slug: components-feedback
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No progress indicator on version uploads or bulk actions; reply submission gives no feedback |
| 2 | Match System / Real World | 3 | Good metaphors (pins, kanban, versions) but stage meanings unexplained to new users |
| 3 | User Control and Freedom | 4 | Escape closes popovers, click-outside dismisses, resolve/unresolve is reversible |
| 4 | Consistency and Standards | 3 | Strong overall; pin colors (#16A34A/#10B981) bypass design tokens; TypeFilterTabs has two styling approaches |
| 5 | Error Prevention | 2 | Delete comment has no confirmation — entire thread vanishes instantly. No upload failure handling |
| 6 | Recognition Rather Than Recall | 3 | Stage descriptions defined in KanbanBoard but never rendered. No affordance hint for click-to-pin |
| 7 | Flexibility and Efficiency | 3 | Keyboard shortcuts for modals/popovers. No bulk actions. No keyboard nav for Kanban columns |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained, semantic, purposeful. No decorative clutter. Color palette is disciplined |
| 9 | Error Recovery | 2 | Generic "Failed to update status" with no root cause. Silent attachment upload failures. No reply-posted confirmation |
| 10 | Help and Documentation | 1 | No help text for stage meanings. No onboarding for first-time Campaigns users. No click-to-pin affordance |
| **Total** | | **28/40** | **Good — solid foundation, critical gaps in error handling and help** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.**

**LLM assessment**: Zero AI slop tells. No gradient text, glassmorphism, side-stripe borders, identical card grids, or eyebrow kickers. Status colors are semantic (green = approved, amber = pause, red = reject). Copy is literal and direct ("Leave feedback", "Pin Comment", "Set status"). Animations are restrained (pulse on pending pin, 120ms fadeIn on modals). The system reads as hand-authored by someone who understands the product domain.

**Deterministic scan**: The bundled detector returned **0 findings** across all three scan targets (components/feedback: 47 files, components/admin/feedback: 75 files, app/campaigns: 9 files). The detector was verified functional — it correctly flagged side-tab borders and a broken image in other subsystems (TextPagePreview.tsx, ViewerStylePreview.tsx, FunnelStepNode.tsx). The feedback components pass cleanly because they use Tailwind classes exclusively, with dynamic inline styles only for branding interpolation.

**LLM + detector agreement**: Both assessments converge on a clean anti-pattern verdict. This is a well-constructed UI with no AI-generated design tells.

## Overall Impression

A technically solid, visually coherent review system that works well for power users who already know the workflow. The architecture is clean — pin scoping per content type, version management, stage-based visibility filtering — these show genuine product thinking. But the system has a trust gap: high-stakes actions (deleting comments, submitting replies, uploading versions) happen silently or without confirmation. First-time reviewers get dropped into the pin interface with no affordance cues. The biggest opportunity is closing the feedback loop — every user action should produce visible confirmation.

## What's Working

1. **Smart pin scoping for content types** (ItemContentView.tsx): Pins placed on email/ad mockups are scoped to that view and don't leak across variants. The `creative` exception keeps pins visible across platform previews. Deep product thinking that prevents confusion.

2. **Version picker UX** (VersionPicker.tsx): Sorted descending (latest first), relative timestamps ("2h ago"), single-click to switch. No full-page reload. The edit pencil affordance is subtle but discoverable.

3. **Focus trap and keyboard accessibility** (GuestOnboardingModal.tsx): Shift+Tab wraps correctly, no focus escape, aria-modal and aria-labelledby present. The modal is screen-reader friendly — rare in this class of app.

## Priority Issues

### [P0] Delete comment has no confirmation
**What**: Clicking Delete in PinCommentPopover instantly removes the comment and all replies. No undo, no confirmation dialog.
**Why it matters**: Reviewers can accidentally destroy entire feedback threads. This is a high-regret, irreversible action. The context (replies, reactions, attachments) is permanently lost.
**Fix**: Wrap the delete handler in a confirmation dialog showing the reply count. Use the existing `useConfirm` pattern with `destructive: true`.
**Suggested command**: `/impeccable harden campaign feedback`

### [P0] Silent reply submission — no feedback after posting
**What**: When a guest submits a reply in PinCommentPopover, the form clears and the popover closes. No toast, no confirmation, no visual acknowledgment.
**Why it matters**: Users don't know if their reply was actually sent. On slow connections, they'll re-submit. On fast connections, the instant close feels like a dismissal, not a success. Trust erosion.
**Fix**: Add `toast.success('Reply posted')` before closing the popover. For pin creation, show "Comment added" with the pin number.
**Suggested command**: `/impeccable harden campaign feedback`

### [P1] Kanban stage meanings undefined for users
**What**: KanbanBoard.tsx defines `STAGE_DESCRIPTIONS` but never renders them. Admin users moving items between columns are guessing what each stage means and who gets notified.
**Why it matters**: Stage choice drives notifications — moving to `client_review` notifies the client. Moving to `internal_review` doesn't. An admin who picks the wrong stage either leaks work-in-progress or fails to notify the client. The stakes are invisible.
**Fix**: Render stage descriptions as tooltips on column headers (info icon + tippy). On first use, show a one-time explainer.
**Suggested command**: `/impeccable clarify campaign feedback`

### [P1] Generic error messages with no root cause
**What**: Error toasts say "Failed to update status" or "Failed to save" with no indication of why (network, permission, validation, server error).
**Why it matters**: Users don't know whether to retry, check their connection, or contact support. Every generic error is a dead end.
**Fix**: Extract the error message from the API response: `toast.error(err.message || 'Failed to update status. Please try again.')`. For network errors specifically, suggest checking the connection.
**Suggested command**: `/impeccable harden campaign feedback`

### [P2] No click-to-pin affordance for first-time reviewers
**What**: Guest reviewers land on the review page with no hint that they can click to place a pin. The cursor stays default on hover. No tooltip, no pulsing animation, no onboarding cue.
**Why it matters**: First-time reviewers (Jordan persona) don't discover the core interaction. They look at the content, don't know how to comment, and either leave or ask the agency how to use the tool. The primary value proposition fails silently.
**Fix**: On first interaction (no pins exist, user hasn't placed one yet), show a subtle "Click anywhere to leave feedback" tooltip that follows the cursor for 3 seconds, then fades. Or: pulse the first pin marker gently.
**Suggested command**: `/impeccable onboard campaign feedback`

## Persona Red Flags

**Alex (Power User / Agency Admin)**: No upload progress indicator when adding a new version — clicks the button and waits with no feedback. Version picker doesn't auto-switch to the newly uploaded version. No bulk status changes across multiple items. No keyboard navigation for Kanban columns. Alex can work, but the system doesn't reward expertise.

**Jordan (First-Timer / Client Reviewer)**: No visible affordance to click and pin (the core action is invisible). PendingPinPopover form is collapsed by default, requiring an extra click to expand. Status taglines ("Send back to the team for changes" vs "Permanently decline this version") assume workflow knowledge Jordan doesn't have. No help or documentation accessible from the review page.

**Agency Account Manager (Project-Specific Persona)**: Setting up a new campaign project requires knowing the stage system upfront — no guided setup wizard. ProjectAssigneesPanel lets you assign reviewers to stages, but there's no explanation of what happens when all assignees approve (auto-advance). The invisible automation is a trust gap for the person accountable for the project.

## Minor Observations

- Pin colors (#16A34A / #10B981) are hardcoded in PinOverlay instead of using design tokens. Should reference a semantic "resolved" token.
- ItemSidebar comment count badge only shows unresolved threads. If all 5 comments are resolved, the badge disappears — users might think there's no feedback on that item. A muted "5 resolved" indicator would help.
- FeedbackDetailView.tsx is 842 lines. Should split per content type (AdItemView, EmailItemView) to reduce cognitive load for contributors.
- TypeFilterTabs has two styling approaches (Tailwind classes vs branded inline styles) — inconsistent theming strategy.
- No activity timeline showing "John approved at 2pm", "Jane requested revision at 3pm". Useful for audit context.

## Questions to Consider

- Why does the Kanban board show all 8 stages but the client status picker shows only 4? The split responsibility isn't communicated — first-time admins don't know which actions are client-visible.
- What if the version picker were a sidebar tab instead of a header dropdown? For items with 10+ versions, a dropdown becomes unwieldy. A sidebar panel would show version notes and full history.
- What would the review experience look like if it opened with a 3-second guided cue — cursor follows with "Click to comment" — then got out of the way forever? The entire value proposition depends on guests discovering a hidden affordance.
