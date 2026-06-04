---
target: campaign whiteboard nodes
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-04T21-54-11Z
slug: components-admin-feedback-board-nodes
---
## Design Health Score

| # | Heuristic | Score | Prev | Key Issue |
|---|-----------|-------|------|-----------|
| 1 | Visibility of System Status | 3 | 3 | Delete undo toasts + comment loading spinner now ship. Missing: no save indicator, no "changes pending" banner. |
| 2 | Match System / Real World | 4 | 4 | Labels clear. Icon node persistent "View" link improves real-world mapping. |
| 3 | User Control and Freedom | 3 | 3 | Undo toasts give escape hatch. Sticky handles now consistent. Arrow endpoint drag still lacks snap. |
| 4 | Consistency and Standards | 3 | 3 | Handles unified across all 4 node families. Icon "View" link mirrors card footer. Remaining: solid vs pastel icon inconsistency. |
| 5 | Error Prevention | 3 | 2 | **+1**: Delete undo toasts on shapes/notes. Still missing: review item removal has no undo. |
| 6 | Recognition Rather Than Recall | 3 | 3 | Action palette tiles now show shortcut hints (D/W/G/C/M/Z). Still no global legend (? button). |
| 7 | Flexibility and Efficiency | 3 | 3 | Shortcut hints visible. Palette tabs + collapsible groups. No search in event picker. |
| 8 | Aesthetic and Minimalist Design | 4 | 4 | Edge labels now 14px (matches body). Clean, restrained. |
| 9 | Error Recovery | 2 | 1 | **+1**: Undo toasts with action button. Comment fetch handles errors gracefully. Still silent on some ops (review item removal, edge cascade). |
| 10 | Help and Documentation | 2 | 2 | Title attributes improved on palette tiles. No keyboard legend or contextual help. |
| **Total** | | **30/40** | **28** | **Good** (+2 from fixes; error recovery and error prevention each gained a point) |

## Anti-Patterns Verdict

**LLM assessment**: Still clean. The fixes don't introduce any AI tells. The persistent "View" link on icon nodes is a standard product affordance. The shortcut hints use `text-2xs text-faint/60 font-mono` which is appropriately subtle.

**Deterministic scan**: 0 findings across all scanned files (nodes, edges, board, palette, context). Exit code 0. Clean.

## Overall Impression

The two P1 issues from the prior critique are resolved. Delete operations now have a visible safety net (undo toasts), and comment counts no longer show stale zeroes while loading. The P2 handle inconsistency is fixed, icon nodes have persistent "View" links, and action tiles show shortcuts. The score moved from 28 to 30, crossing into the solid "Good" range. The remaining issues are lower-severity: review item removal still lacks undo, arrow endpoints don't snap, and the 35 event types could use search.

## What Improved

1. **Delete undo toasts** ([FeedbackBoardContext.tsx:376, 477](components/admin/feedback/board/FeedbackBoardContext.tsx#L376)): `deleteNote` and `deleteShape` now show "Note/Shape deleted" with a 6s "Undo" action. The undo button calls back into the history stack, restoring the shape + its incident edges. This is the single biggest trust improvement.

2. **Comment loading state** ([FeedbackItemNode.tsx:49-65](components/admin/feedback/board/nodes/FeedbackItemNode.tsx#L49-L65)): Card footers show a spinner + "…" while comment counts fetch. No more stale zeroes that imply "no comments" when the data hasn't loaded yet.

3. **Unified handles** ([StickyNoteNode.tsx:76](components/admin/feedback/board/nodes/StickyNoteNode.tsx#L76)): Sticky notes now use the same `!bg-ink/70 !border-2 !border-white hover:!bg-teal` pattern and all-source type as every other node. The invisible handles and inconsistent `hover:!bg-gray-400` are gone.

4. **Persistent View on icon nodes** ([nodeConfig.tsx:496-504](components/admin/feedback/board/nodes/nodeConfig.tsx#L496-L504)): Eye icon + "View" link below the circle, visible at all times. Matches CardShell footer. Hover overlay still works as a secondary affordance.

5. **Action shortcut hints** ([FeedbackPalette.tsx:436-438](components/admin/feedback/board/FeedbackPalette.tsx#L436-L438)): D/W/G/C/M/Z visible top-right on action tiles, small mono font. Title attributes updated.

## Priority Issues (remaining)

### [P2] Review item removal has no undo
**What**: `removeItemFromBoard` ([FeedbackBoardContext.tsx:266-283](components/admin/feedback/board/FeedbackBoardContext.tsx#L266-L283)) clears `board_x`/`board_y` and deletes incident edges without recording history or showing a toast. Shapes and notes got the undo treatment; review items didn't.
**Why it matters**: Accidentally removing a positioned review item from a complex board loses its layout context. The item goes back to the "unplaced" list but edges are gone.
**Fix**: Add `recordHistory` + `toast.info('Item removed', { action: { label: 'Undo' } })` following the same pattern as `deleteNote`/`deleteShape`.
**Suggested command**: `/impeccable harden campaign whiteboard nodes`

### [P3] Arrow endpoint drag has no snap grid
**What**: Arrow/line endpoint dragging in [ShapeNode.tsx:185-208](components/admin/feedback/board/nodes/ShapeNode.tsx#L185-L208) uses raw mouse delta with no 20px snap, inconsistent with the canvas snap grid.
**Why it matters**: Users get pixel-level jitter when trying to align arrows. Undo, retry, repeat.
**Fix**: Round endpoint delta to the nearest 20px during drag, matching the canvas snap grid.
**Suggested command**: `/impeccable polish campaign whiteboard nodes`

### [P3] No global keyboard shortcut legend
**What**: 12+ shortcuts exist but the only discovery mechanism is hovering palette tiles. No `?` button or help modal.
**Why it matters**: Power users would benefit enormously but never discover these shortcuts organically.
**Fix**: Add a `?` button near the undo/redo panel that opens a shortcut legend overlay.
**Suggested command**: `/impeccable clarify campaign whiteboard`

## New Issues from Fixes

### [P3] Redundant View affordances on icon nodes
**What**: Icon nodes now have both a persistent "View" link below the circle AND a hover overlay covering the circle with "View" text. Both navigate to the same detail view.
**Why it matters**: Mildly redundant. Not confusing (both do the same thing), but the overlay is now arguably unnecessary since the persistent link handles discoverability.
**Fix**: Consider removing the hover overlay or making it lighter (just a subtle highlight, not a full bg-ink/55 cover). Low priority since both work and neither breaks anything.

## Persona Red Flags

**Alex (Power User)**: Undo toasts are a relief. Shortcut hints visible on action tiles. Still can't discover event-type shortcuts beyond D/W/G/C/M/Z. Still no bulk operations.

**Riley (Stress Tester)**: Delete → undo toast → click "Undo" works reliably. But removing a review item from the board is still silent. Edge cascade on shape delete is undoable, which is good.

**Mia (Account Manager)**: Persistent "View" link on icon nodes helps her find the navigation without hovering. Comment loading spinner prevents the misleading "0 comments" state.

## Minor Observations

- Sticky note handle class is hardcoded inline rather than importing the `HANDLE_BASE` constant from nodeConfig. Works identically but creates duplication.
- Edge labels at 14px now sit well against node titles. Older edges with explicit 16px+ are unaffected (no migration needed).
- FacebookLogo extraction to nodeConfig cleans up duplication. Both FacebookNode and MetaLeadFormNode import the shared component.
- Comment loading spinner could theoretically flicker on very fast fetches (<50ms). A 150ms debounce before showing the spinner would prevent this, but it's a micro-polish concern.

## Questions to Consider

- Should the icon node hover overlay be removed now that a persistent "View" link exists, or does the overlay's type label ("EMAIL", "SMS") add enough context to justify the redundancy?
- Would a search/filter in the Actions palette tab be more impactful than a keyboard shortcut legend, given that both address discoverability?
