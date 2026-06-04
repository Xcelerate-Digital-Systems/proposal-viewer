---
target: components/admin/feedback/board
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-04T22-13-08Z
slug: components-admin-feedback-board
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No save indicator, no board-state summary (placed vs unplaced count) |
| 2 | Match System / Real World | 3 | Miro/Figma conventions mostly followed; palette groupings may not match user mental models |
| 3 | User Control and Freedom | 3 | Undo/redo capped at 30 ops; no "clear all" or abandon-changes safeguard |
| 4 | Consistency and Standards | 3 | Design tokens consistent; modal/drawer positioning differs (absolute vs fixed) |
| 5 | Error Prevention | 2 | No confirmation on delete, no validation on blank shapes, 6px delete hit targets |
| 6 | Recognition Rather Than Recall | 3 | Shortcuts labeled on tiles; 27 palette options with no search or favourites |
| 7 | Flexibility and Efficiency | 3 | Keyboard shortcuts, snap grid, alignment guides; missing bulk alignment and auto-layout |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and restrained; palette shows all options at once, no progressive disclosure |
| 9 | Error Recovery | 3 | Undo/redo functional; edge deletion auto-cascades silently when removing a node |
| 10 | Help and Documentation | 2 | Empty-state card and shortcut hints; no onboarding tour, no contextual help |
| **Total** | | **28/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment:** Clean. No AI slop detected. Human-authored and intentional. No side-stripe borders, gradient text, glassmorphism, identical card grids, or numbered section markers. Handle geometry and alignment guides show engineering craft. One minor contrast concern: text-ink/40 on keyboard shortcut labels may fail 4.5:1 against white.

**Deterministic scan:** detect.mjs returned [] — zero findings across all 26 files. Manual review confirmed no anti-patterns.

## Overall Impression

Competent, ambitious whiteboard that respects Miro/Figma interaction models and AgencyViz's restrained design. Connection handle geometry, alignment guides, undo/redo, and copy/paste are well-built. Biggest gap is safety: destructive operations have no confirmation, blank shapes create visual noise, and there's no onboarding.

## What's Working

1. **Connection handle precision** (nodeConfig.tsx:72-155). SHARED_SIDE_HANDLE_Y unifies y-position across diamonds, circles, and cards.
2. **Undo/redo with toast + inline undo** (FeedbackBoardContext.tsx:204-236). History system with 30-op cap, suppress-during-replay, and toast undo actions.
3. **Drag-and-drop palette with keyboard shortcuts** (FeedbackPalette.tsx, FeedbackBoard.tsx:556-577). Three input paths: click, drag-to-canvas, keyboard shortcut.

## Priority Issues

### [P1] Delete operations have no confirmation and tiny hit targets
Deleting a sticky note, shape, or item has no confirmation. Sticky note delete button is 6px. Undo stack caps at 30. Removing a node silently deletes all attached edges (FeedbackBoardContext.tsx:277-279).
**Fix:** useConfirm() before delete for nodes with connections/content. Grow action targets to 24x24px.
**Suggested command:** /impeccable harden

### [P1] No keyboard-accessible connection workflow
Creating connections requires mouse-dragging. No keyboard alternative. Handle dots have no ARIA labels. Palette tiles rely on title attributes, not aria-label. Status dropdown doesn't trap focus.
**Fix:** Keyboard connection mode (Shift+C → arrow keys → Enter). Add aria-label to handles and palette tiles. Trap focus in dropdowns.
**Suggested command:** /impeccable harden

### [P2] Palette cognitive overload — 27 entry points with no progressive disclosure
Palette shows all 18 action shapes + 4 drawing tools + sticky notes + items simultaneously. No search, no favourites, no recently-used.
**Fix:** Add search/filter input. "Recently Used" section via localStorage. Collapse sub-groups by default.
**Suggested command:** /impeccable distill

### [P2] No onboarding or first-time user guidance
Empty-board state shows single card. No tutorial for drawing, connecting, locking, or shortcuts. react-joyride already in the stack.
**Fix:** 4-step joyride tour. Show on first visit via localStorage flag.
**Suggested command:** /impeccable onboard

### [P2] Drawer/menu positioning inconsistency
Side drawers use position:absolute z-30. Context menu and export use position:fixed. Overlapping produces unpredictable stacking.
**Fix:** Documented z-index constants. Portal-based context menus.
**Suggested command:** /impeccable layout

## Persona Red Flags

**Alex (Power User):** No bulk alignment tools. No search in palette. No auto-layout. Snap grid always on (no toggle).

**Sam (Accessibility):** Cannot create connections via keyboard. Palette tiles announce as unlabeled "button". Status dropdown doesn't trap focus. Color-only state changes on handles.

## Minor Observations

- Rough.js aesthetic baked in with no clean-lines toggle. Dense boards get noisy.
- Edge label bias (0.4) can overlap source node with long text.
- Mini-map at 140x90px too small for 30+ node boards.
- No "Copy share link" button in the board UI despite auto-created board_share_token.
- StickyNoteNode has duplicate Handle definitions (legacy aliases).
- Missing focus:ring on ShapeSideDrawer inputs.

## Questions to Consider

1. Is this board internal-only or client-facing? Client-facing raises the onboarding bar significantly.
2. Should flow shapes (decision/wait) look different from action shapes (goal/call/meeting)? All render as colored diamonds currently.
3. Would an auto-layout button (Dagre/ELK) solve the spaghetti board problem?
