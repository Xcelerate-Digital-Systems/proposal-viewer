# Campaign Whiteboard & Funnel Planner — Deep Dive Audit

**Date:** 2026-06-02
**Scope:** Campaign Whiteboard (`/campaigns/[id]/board`) and Funnel Planner (`/funnels/[id]`)
**Goal:** Funnelytics/Miro parity assessment, bug triage, UX gap analysis

---

## 1. Executive Summary

The Campaign Whiteboard and Funnel Planner share a common React Flow foundation but diverge significantly in maturity. The Funnel Planner has working analytics overlays, undo/redo, and scenario switching, while the Campaign Whiteboard lacks all three. Four user-reported bugs were investigated: two are confirmed code-level bugs (feedback asset placement at origin, duplicate Wait node controls), one is a misattributed visual issue (handle misalignment originates from CardShell, not IconShell), and one (dead stroke control) is confirmed on diamond shapes specifically. Beyond these, the audit uncovered 11 additional bugs and 8 UX gaps, plus a structured list of missing features relative to Funnelytics and Miro.

---

## 2. Confirmed Known Issues

| # | Reported Issue | Status | Root Cause | Affected Code |
|---|---|---|---|---|
| 1 | **Feedback assets drop at canvas origin, not viewport center** | **Confirmed bug** | `FeedbackPalette` Items tab uses fixed grid math (`x = 100 + (count % 4) * 280`) with no `screenToFlowPosition` call. Action shapes in the same palette correctly call `viewportCentre()`. | `FeedbackPalette` — Items tab click handler |
| 2 | **Wait node has duplicate controls (popup AND sidebar)** | **Confirmed bug** | Inline editor (double-click) exposes duration + unit + label. Sidebar drawer exposes only label. Both read/write the same `content` JSON. The sidebar is incomplete (missing duration/unit), creating confusion about which surface is canonical. | `WaitDiamond` inline editor + `ShapeSideDrawer` wait branch |
| 3 | **Stroke control in sidebar does nothing on most nodes** | **Confirmed — on diamond shapes only** | Diamond shapes (wait, decision, event/action) render via CSS `div` with `background` + `outline`. The `stroke_width` and `dashed` fields are completely ignored in the diamond render path. SVG primitives (rect, ellipse, arrow, line) DO respect stroke controls. The sidebar correctly hides stroke controls for diamonds in the Funnel Planner's `ShapeSideDrawer` via `hasStroke` gating, but the Campaign Whiteboard's version may not apply the same gating. | Diamond shape render components, `ShapeSideDrawer` |
| 4 | **Horizontal guide on SMS & Email assets isn't centered** | **Misattributed — real issue is at CardShell end** | IconShell handles are correctly at Y=100 (circle center). The visual misalignment occurs when connecting to a CardShell node (webpage, image, video, pdf) whose handles sit at CSS `top: 50%` — at min-height 240px that's Y=120, producing a 20px diagonal. The problem is inconsistent handle Y across node types, not an IconShell bug. | `CardShell` handle positioning vs. `IconShell` fixed Y=100, `SHARED_SIDE_HANDLE_Y` constant declared but unused |

---

## 3. Additional Bugs Found

| # | Bug | Severity | Details |
|---|---|---|---|
| 1 | **Sticky note edges not persisted** | High | Edges connected to sticky notes use `temp-*` IDs and live only in React Flow state. They are lost on page reload. | 
| 2 | **Alignment guides compute snap but don't apply it** | Medium | `AlignmentGuides.tsx` calculates `snapDX`/`snapDY` deltas when nodes align within 6px tolerance, but the values are never applied to node position — guides are visual-only with no magnetic snap. |
| 3 | **Background grid doesn't pan/zoom** | Medium | CSS dot-pattern background is static. When the user pans or zooms the canvas, the grid stays fixed, breaking spatial reference. Affects both boards. |
| 4 | **Copy/Paste is broken** | Medium | Context menu shows "Paste" option but `canPaste` is hardcoded to `false`. No clipboard integration exists. |
| 5 | **Keyboard shortcuts displayed but not wired** | Medium | Campaign Whiteboard toolbar shows shortcut labels (V, R, O, A, L, T, N, D, W, G, C, M, Z, F) but no `keydown` event handlers are registered. |
| 6 | **Arrow/line shapes cannot be resized after creation** | Medium | `end_x`/`end_y` are set at creation time with no resize/reshape handles. Users must delete and redraw to adjust. |
| 7 | **`SHARED_SIDE_HANDLE_Y` constant is unused** | Low | Declared at Y=100 but never referenced by `IconHandles`. Handle positions are hardcoded inline. If someone updates the constant expecting handle positions to change, nothing happens. |
| 8 | **Sticky notes use fixed grid for click placement** | Low | Click-to-place uses `x = 50 + (count % 3) * 240; y = 400`. Dragged notes get repositioned correctly. Click placement has the same viewport-blind problem as feedback items but is less impactful since sticky notes are secondary objects. |
| 9 | **No fitView or viewport pan after placing feedback items** | Low | After placing an item at the fixed-grid origin, the viewport does not scroll to show the new node. If the user has panned away, the item appears off-screen with no indication. |
| 10 | **No delete confirmation dialog** | Low | Deleting nodes/shapes from any sidebar drawer has no confirmation step. One-click destructive action. |
| 11 | **Undo/Redo in Funnel Planner excludes shapes and notes** | Low | The 30-entry undo stack only tracks steps and edges. Shape and sticky note operations are not undoable. |

---

## 4. UX Gaps

| # | Gap | Impact | Notes |
|---|---|---|---|
| 1 | **No undo/redo on Campaign Whiteboard** | High | Funnel Planner has it (partial). Campaign Whiteboard has none. Any accidental deletion or move is permanent. |
| 2 | **No Cmd+A select-all** | Medium | Neither board supports select-all. Multi-select requires manual drag-box. |
| 3 | **No node grouping or frames** | Medium | Cannot logically group related nodes. Both Funnelytics and Miro support this. |
| 4 | **Selecting a reviewItem navigates away from board** | Medium | Clicking a feedback item on the Campaign Whiteboard navigates to the item detail view instead of opening a sidebar. This breaks canvas flow — users lose their board context. |
| 5 | **Inconsistent snap grid granularity** | Low | Campaign Whiteboard uses [20,20] snap grid; Funnel Planner uses [4,4]. The coarser grid on the Campaign Whiteboard makes precise layout harder. |
| 6 | **No lock/unlock for nodes** | Low | Lock/Unlock icons are imported but the feature is not implemented. Users cannot protect finalized layouts from accidental moves. |
| 7 | **No connection constraints** | Low | `ConnectionMode.Loose` allows any node to connect to any node. No type-based rules (e.g., preventing feedback-item-to-feedback-item connections). |
| 8 | **Funnel Planner has no drawing tools** | Low | Campaign Whiteboard has rect, ellipse, arrow, line, text drawing tools. Funnel Planner has none. Limits freeform annotation on funnels. |

---

## 5. Missing Funnelytics/Miro Parity Features

### vs. Funnelytics

| Feature | Current State | Gap |
|---|---|---|
| **Live analytics ingestion** | All numbers (visitors, conversion %, cost, value) are manually entered | No API or tracking-script integration to auto-populate funnel metrics |
| **Automatic page screenshots** | No URL-to-screenshot capability | Funnelytics auto-captures page screenshots from step URLs |
| **A/B split test node** | Only manual edge split-% labels | No dedicated split-test node type with variant tracking |
| **Goal nodes wired to analytics** | Goal concept doesn't exist | No goal/conversion event node that aggregates downstream metrics |
| **Visual countdown on Wait nodes** | Wait node shows static duration text | No live countdown timer or visual progress indicator |
| **Conversion ring overlays on edges** | Edge labels show text percentages only | No donut/ring chart overlays on edges showing conversion rates visually |
| **Side-by-side scenario comparison** | ScenarioSwitcher can clone and switch, but no diff view | Cannot compare two scenarios visually in parallel |

### vs. Miro

| Feature | Current State | Gap |
|---|---|---|
| **Frames / sections** | Not implemented | Cannot group nodes into named, collapsible frames |
| **Freeform drawing** | Campaign Whiteboard has it; Funnel Planner does not | Partial coverage |
| **Voting / reactions on canvas** | Not implemented | No emoji reactions or voting dots on canvas items |
| **Presentation mode** | Not implemented | No sequential slide-through of canvas regions |
| **On-canvas comments** | Comments only exist in item detail view (Campaign Whiteboard) | Cannot leave contextual comments directly on the canvas |
| **Template gallery** | No whiteboard or funnel layout templates | Users start from blank canvas every time |
| **Timer widget** | Not implemented | No collaborative timer for workshops or reviews |
| **Collaborative cursors** | Not implemented | No real-time presence indicators for multi-user editing |

---

## 6. Recommendations

### Critical (fix before next release)

| # | Action | Effort | Rationale |
|---|---|---|---|
| 1 | **Fix feedback item placement to use viewport center** | Small | Replace fixed-grid math in `FeedbackPalette` Items tab with `viewportCentre()` (already implemented for action shapes in the same file). Optionally pan viewport to the new node. |
| 2 | **Persist sticky note edges to database** | Medium | Sticky note edges using `temp-*` IDs are silently lost on reload. Users building board layouts with sticky notes lose all connections. |

### High (next sprint)

| # | Action | Effort | Rationale |
|---|---|---|---|
| 3 | **Unify Wait node editing surface** | Small | Either: (a) add duration/unit fields to the sidebar drawer and remove the inline popup, or (b) remove Wait from the sidebar entirely and keep only the inline editor. Option (a) is more consistent with how all other shapes work. |
| 4 | **Normalize handle Y across node types** | Medium | Define a single `HANDLE_Y` constant and use it in both `CardShell` and `IconShell`. This eliminates the diagonal-edge problem between card and icon nodes. Use the existing `SHARED_SIDE_HANDLE_Y` constant instead of leaving it unused. |
| 5 | **Wire keyboard shortcuts** | Small | Add `keydown` event handlers for the 14 shortcut keys already displayed in the Campaign Whiteboard toolbar. Currently misleading — labels suggest functionality that doesn't exist. |
| 6 | **Add undo/redo to Campaign Whiteboard** | Medium | Port the Funnel Planner's undo stack pattern. Extend it to cover shapes and sticky notes (currently excluded even in Funnel Planner). |
| 7 | **Hide stroke controls for diamond shapes** | Small | Apply the same `hasStroke` gating from Funnel Planner's `ShapeSideDrawer` to the Campaign Whiteboard's version. Diamonds render via CSS, not SVG, so stroke controls are meaningless. |

### Medium (backlog)

| # | Action | Effort | Rationale |
|---|---|---|---|
| 8 | **Implement magnetic snap on alignment guides** | Small | The snap deltas are already computed in `AlignmentGuides.tsx`. Apply them to node position during drag to complete the feature. |
| 9 | **Make background grid pan/zoom with canvas** | Small | Replace static CSS dot pattern with React Flow's `<Background>` component or a pattern that transforms with the viewport. |
| 10 | **Add node grouping / frames** | Large | Key Miro parity feature. Allows users to organize complex boards into logical sections. |
| 11 | **Implement copy/paste** | Medium | Remove the non-functional "Paste" context menu item or implement clipboard serialization for nodes and edges. |
| 12 | **Add delete confirmation for destructive actions** | Small | Simple confirm dialog before node/shape deletion from sidebar drawers. |
| 13 | **Add resize handles for arrow/line shapes** | Medium | Allow adjusting `end_x`/`end_y` after creation so users don't need to delete and redraw. |

### Low (future consideration)

| # | Action | Effort | Rationale |
|---|---|---|---|
| 14 | **Template gallery for boards and funnels** | Large | Pre-built layouts reduce blank-canvas friction. |
| 15 | **Presentation mode** | Large | Sequential walk-through of canvas regions for client presentations. |
| 16 | **On-canvas comments** | Large | Contextual discussion without leaving the board view. |
| 17 | **URL-to-screenshot on funnel steps** | Medium | Auto-capture page screenshots from step URLs (Funnelytics parity). |
| 18 | **Extend Funnel Planner undo to shapes/notes** | Small | Current undo stack only covers steps and edges. |
| 19 | **Add drawing tools to Funnel Planner** | Medium | Parity with Campaign Whiteboard's rect/ellipse/arrow/line tools. |
| 20 | **Connection type constraints** | Small | Replace `ConnectionMode.Loose` with rules that prevent nonsensical connections. |
| 21 | **Lock/unlock nodes** | Small | Icons already imported. Wire up the toggle to prevent accidental moves on finalized layouts. |

---

## 7. Open Questions

1. **Should handle Y be standardized at 100 or at 50%?** Fixed pixel (100) makes edges perfectly horizontal but requires all nodes to have uniform height. Percentage-based (50%) adapts to content but creates diagonals between different-height nodes. A hybrid approach (fixed Y with a max-height constraint) may be needed.

2. **What is the intended canonical editing surface for Wait nodes?** The inline popup and sidebar serve overlapping but incomplete roles. Product decision needed: sidebar-only (consistent with other shapes) or inline-only (richer inline editing pattern)?

3. **Should the Campaign Whiteboard gain analytics overlays?** The Funnel Planner has a Numbers Layer with per-node visitors/conversions/revenue. Adding this to the Campaign Whiteboard would unify the feature set but may muddy the tool's purpose (creative review vs. funnel analytics).

4. **Are sticky note edges intentionally ephemeral?** If sticky notes are meant to be transient annotations, non-persisted edges might be by design. If they're meant to be durable board elements, this is a data-loss bug.

5. **Should alignment guides magnetically snap?** The snap deltas are computed but not applied. This could be an intentional "guides only" design choice, or it could be an incomplete implementation. If magnetic snap is added, it should likely be toggleable.

6. **What is the target snap grid granularity?** Campaign Whiteboard uses [20,20] and Funnel Planner uses [4,4]. Should these be unified? The coarser grid is faster for rough layouts; the finer grid allows precise positioning.

7. **Should selecting a reviewItem on the Campaign Whiteboard open a sidebar instead of navigating away?** Current behavior breaks canvas context. A sidebar preview (with a "View details" link) would keep users on the board while still providing item context.
