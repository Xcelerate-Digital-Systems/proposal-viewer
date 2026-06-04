---
target: campaign whiteboard nodes
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-04T21-41-43Z
slug: components-admin-feedback-board-nodes
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No save indicator or "changes pending" state; comment fetch in FeedbackItemNode has no loading/error UI |
| 2 | Match System / Real World | 4 | Labels match real workflow: "Web Page", "Email", "Draft" → "Approved". Terminology is clean. |
| 3 | User Control and Freedom | 3 | Undo/redo works, Escape cancels editing. But no delete confirmation, no "undo" toast after destructive actions. |
| 4 | Consistency and Standards | 3 | CardShell vs IconShell "View" button uses two different patterns. Sticky note handles differ from all other node handle styling. |
| 5 | Error Prevention | 2 | No confirmation before deleting shapes/notes. Decision diamond allows empty branches without warning. |
| 6 | Recognition Rather Than Recall | 3 | Icons + labels on every type. Status pills color-coded. But keyboard shortcuts for Actions tab items (d/w/g/c/m/z) are invisible in the UI. |
| 7 | Flexibility and Efficiency | 3 | 12+ keyboard shortcuts, Cmd+C/V/D/Z, context menu, drag-and-drop, palette tabs with collapsible groups. No search in event picker. |
| 8 | Aesthetic and Minimalist Design | 4 | Clean, restrained. Teal accent at ≤10%. Typography hierarchy clear. Diamond nodes deliberately compact. No decorative chrome. |
| 9 | Error Recovery | 1 | No visible error messages anywhere. API failures silent. Comment fetch errors unhandled. Palette drag-drop fails without feedback. |
| 10 | Help and Documentation | 2 | Empty state card with guidance. Palette hint text. No keyboard shortcut legend, no contextual tooltips on action types. |
| **Total** | | **28/40** | **Good** (low end — error recovery is the drag) |

## Anti-Patterns Verdict

**LLM assessment**: This does NOT look AI-generated. The whiteboard nodes show clear authorial intent — the handle geometry is precision-engineered (CardHandles, IconHandles, and DiamondHandles all share Y=100 for horizontal alignment), the decision diamond branching is a novel compact layout, and the restrained teal accent follows the design system rules. No gradient text, no glassmorphism, no side-stripe borders, no identical card grids. The 4 node families (card, icon, diamond, sticky) create a distinct visual vocabulary rather than one-size-fits-all.

**Deterministic scan**: The Impeccable detector returned **0 findings** across all 15 scanned files (13 nodes, 1 edge, 1 board controller). Exit code 0 (clean). No AI slop patterns, color/contrast issues, typography problems, or motion anti-patterns detected in the code-level scan. This is consistent with the LLM assessment — the codebase is clean of the patterns the detector catches.

## Overall Impression

This is a well-engineered whiteboard with excellent visual language — the 4 node families (card/icon/diamond/sticky) are visually distinct, and the handle geometry is impressively precise. The palette's 3-tab structure (Items/Actions/Drawing) with collapsible groups is good progressive disclosure. The single biggest gap is **error recovery**: nothing in this surface tells the user when something goes wrong, and destructive actions have no safety net beyond hidden Cmd+Z. That's the difference between "well-built" and "trustworthy."

## What's Working

1. **Handle alignment geometry** ([nodeConfig.tsx:108](components/admin/feedback/board/nodes/nodeConfig.tsx#L108)): CardHandles, IconHandles, and DiamondHandles all share `SHARED_SIDE_HANDLE_Y = 100`, meaning a webpage card, an email circle, and a decision diamond on the same row connect with straight horizontal arrows. This invisible precision prevents spaghetti and is the kind of detail that separates a tool from a toy.

2. **Decision diamond compact layout** ([ShapeNode.tsx:600-689](components/admin/feedback/board/nodes/ShapeNode.tsx#L600-L689)): A 42×42 rotated square with GitBranch icon, question label below, and 4 branch pills arranged via CSS grid — all inline, no modal. The 7-color branch palette is expressive without being noisy. This is the single most distinctive element on the whiteboard.

3. **Status affordances split by node type** ([nodeConfig.tsx:183-277](components/admin/feedback/board/nodes/nodeConfig.tsx#L183-L277)): Card nodes get a pill-style StatusPicker in the footer. Icon nodes get a dot variant bottom-right of the circle. The split is intentional — pills suit the card's vertical layout, dots suit the circle's compact form. This avoids the "one pattern everywhere" trap.

## Priority Issues

### [P1] Silent failure on every network operation
**What**: FeedbackItemNode fetches comment counts on mount ([FeedbackItemNode.tsx:50-65](components/admin/feedback/board/nodes/FeedbackItemNode.tsx#L50-L65)) with no loading state, no error handling, and no retry. Shape/note CRUD in `useFeedbackBoard` and `FeedbackBoardContext` also has no UI feedback on failure. Palette drag-and-drop silently swallows errors.
**Why it matters**: Users build complex flows, save, and leave. If a network blip drops a shape create or a comment count fails, the user has no way to know. Trust erodes silently.
**Fix**: Add a toast on mutation failure ("Couldn't save — retry?"). Show a subtle loading skeleton on comment counts. Surface an error boundary for the board.
**Suggested command**: `/impeccable harden campaign whiteboard nodes`

### [P1] No delete confirmation or undo visibility
**What**: Deleting a sticky note, shape, or decision branch is instant — no confirmation dialog, no undo toast. The undo/redo panel exists top-left but is easy to miss, and shows no preview of what was undone.
**Why it matters**: An accidental Delete keypress on a decision diamond with 4 configured branches vaporizes work. Users who don't know Cmd+Z exists are stuck.
**Fix**: Show an inline "Undo" toast (4s auto-dismiss) after any delete. The design system already has toast infrastructure — use it.
**Suggested command**: `/impeccable harden campaign whiteboard nodes`

### [P2] Sticky note handles diverge from all other node handles
**What**: Sticky note handles use `!bg-transparent !border-0 hover:!bg-ink` ([StickyNoteNode.tsx:77](components/admin/feedback/board/nodes/StickyNoteNode.tsx#L77)), while every other node uses `!bg-ink/70 !border-2 !border-white hover:!bg-teal`. The right handle even uses `hover:!bg-gray-400` instead ([StickyNoteNode.tsx:178](components/admin/feedback/board/nodes/StickyNoteNode.tsx#L178)). Additionally, sticky notes use mixed `type="source"` / `type="target"` handles while all other nodes use all-source.
**Why it matters**: Users learn "dark dot with white border = connection point" from card/icon/diamond nodes, then can't find the invisible handles on sticky notes. The inconsistency also means edges to/from sticky notes may behave differently due to the source/target type difference.
**Fix**: Align sticky note handles to the shared `HANDLE_BASE` pattern from nodeConfig.tsx. Switch to all-source to match other nodes.
**Suggested command**: `/impeccable polish campaign whiteboard nodes`

### [P2] CardShell vs IconShell "View" interaction split
**What**: Card nodes show "View" as an always-visible link in the footer ([nodeConfig.tsx:388-411](components/admin/feedback/board/nodes/nodeConfig.tsx#L388-L411)). Icon nodes hide it behind a full-circle hover overlay ([nodeConfig.tsx:475-486](components/admin/feedback/board/nodes/nodeConfig.tsx#L475-L486)). Same action, two discovery patterns.
**Why it matters**: A user clicks the footer "View" link on a webpage card, then moves to an email circle and looks for the same link — it's not there until they hover. Muscle memory breaks.
**Fix**: Either add a small "View" label below icon nodes (like the title above, but below the circle), or adopt the hover overlay for both card and icon nodes.
**Suggested command**: `/impeccable polish campaign whiteboard nodes`

### [P2] Keyboard shortcuts for Actions are invisible
**What**: The keyboard handler maps `d/w/g/c/m/z` to decision/wait/goal/call/meeting/automation ([FeedbackBoard.tsx:557-576](components/admin/feedback/board/FeedbackBoard.tsx#L557-L576)), but these shortcuts don't appear anywhere in the UI. The Drawing tab shows shortcut letters (V, R, O, A, L, T) on its tiles, but the Actions tab has no hint.
**Why it matters**: Power users who work on the board daily would benefit enormously from these shortcuts — but they'll never discover them without reading source code.
**Fix**: Add shortcut hint text (e.g. "D") to Action palette tiles, matching the Drawing tab pattern. Add a `?` button near the undo/redo panel that shows a shortcut legend.
**Suggested command**: `/impeccable clarify campaign whiteboard`

## Persona Red Flags

**Alex (Power User — agency creative director who builds 20+ node funnels daily)**:
- Keyboard shortcuts exist and he'd love them — but he'll never find `d` for decision or `w` for wait without the Drawing tab's hint pattern.
- Cmd+C/V/D work for shapes and notes but explicitly skip review items (FeedbackItemNode). Alex tries to duplicate a webpage card via Cmd+D — nothing happens. No error, no explanation.
- No bulk operations: changing 5 email nodes to SMS requires 5 individual edits. On a 30-node board, repetitive tasks compound.
- Arrow endpoint dragging has no snap grid — Alex wants 20px-aligned arrows but gets pixel-level jitter.

**Riley (Stress Tester — QA who probes edge cases)**:
- Creates a decision diamond, fills all 4 branches with labels and colors, then hits Delete. Gone instantly. Cmd+Z works but Riley didn't know it was recoverable — the UI gave no signal.
- Opens the board with 15 webpage nodes, each loading an iframe at 500% scale (WebsiteNode). Browser tab memory spikes. On a lower-spec machine, the board becomes sluggish.
- Drags a shape from the palette to the canvas during a network blip — nothing appears. Drags again, network recovers, two shapes appear. No dedup, no feedback during the gap.
- Leaves a decision diamond with question "Decision?" and all 4 branches empty (dash placeholders). Exports the board — the empty state looks broken in the export.

**Mia (Agency Account Manager — non-technical, occasional board user)**:
- Opens the whiteboard for the first time. Sees the empty state card ("Build your funnel board") with a MousePointer icon. Clicks the icon — nothing happens (it's decorative). Doesn't notice the palette sidebar.
- Finds the palette, clicks "Actions" tab. Sees 5 collapsible groups (Conversion, Engagement, Integration, GoHighLevel, Custom). Doesn't know what "GoHighLevel" means. Clicks a "Button Click" tile — a diamond appears at viewport center. She expected a button, not a diamond. The mental model mismatch is immediate.
- Hovers an email circle node. An overlay covers the entire circle with "View / EMAIL" text. She thinks she broke it. Clicks to dismiss — it navigates her away from the board. No breadcrumb back.

## Minor Observations

- **FacebookLogo SVG is duplicated** identically in [FacebookNode.tsx:5-18](components/admin/feedback/board/nodes/FacebookNode.tsx#L5-L18) and [MetaLeadFormNode.tsx:3-16](components/admin/feedback/board/nodes/MetaLeadFormNode.tsx#L3-L16). Extract to a shared component.
- **ShapeNode.tsx is 1077 lines** handling 8+ distinct shape types. Decision, Wait, and EventDiamond are each substantial enough for their own file. This is a maintenance burden, not a UX issue, but it increases the risk of regression when editing one shape type.
- **Icon node solid vs pastel inconsistency**: EmailNode (red, solid) and SMSNode (green, solid) use full-color circles with white icons. FacebookNode (#DBEAFE, pastel) and GoogleAdNode (#FEF3C7, pastel) use light tints with colored logos. The visual split is intentional (channel vs platform), but creates two sub-languages within IconShell that aren't explained.
- **WebsiteNode iframe performance**: Each node loads a full page at 500% scale with `scale(0.2)`. On a board with 10+ webpage nodes, this means 10+ concurrent iframe loads. Consider: lazy-load iframes only when the node is in viewport, or use a static thumbnail screenshot instead.
- **Decision branch pill `min-w-[40px]`** ([ShapeNode.tsx:529](components/admin/feedback/board/nodes/ShapeNode.tsx#L529)) means even empty branches take 40px. With 4 branches + a 42×42 diamond + gaps, the decision node's total footprint is 202×234 — close to a card node's 240×240. If the diamond is meant to be "deliberately small," it isn't when branches are shown.
- **Edge label font size defaults to 16px** ([LabeledEdge.tsx:167](components/admin/feedback/board/edges/LabeledEdge.tsx#L167)), which is larger than the body text (14px). On a zoomed-out board, edge labels can visually outweigh node titles. Consider defaulting to 13-14px.

## Questions to Consider

- **Should decision diamonds show all 4 branches by default, or start with 2 (top/bottom) and let users add sides?** The 4-branch default creates visual complexity before the user has decided their flow logic. A 2-branch default (yes/no) would match the most common decision pattern and reduce initial noise.
- **What happens when 15 webpage nodes each load an iframe?** The current approach (500% scale + scale(0.2)) is elegant but expensive. Would a "preview mode" toggle (thumbnails vs live iframes) give power users the performance they need while keeping the visual fidelity for smaller boards?
- **Is the whiteboard the right place for status management?** Each node has a StatusPicker that can change status. But the Kanban view is purpose-built for status workflows. Having the same mutation surface in two places invites confusion about which is the "source of truth" for status changes.
