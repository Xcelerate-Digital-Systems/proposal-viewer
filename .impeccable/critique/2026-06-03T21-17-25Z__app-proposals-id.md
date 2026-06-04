---
target: proposal builder editor tabs
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-06-03T21-17-25Z
slug: app-proposals-id
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Autosave badge excellent; no per-tab completion indicators |
| 2 | Match System / Real World | 3 | Good domain language; URL paths leak internal naming |
| 3 | User Control and Freedom | 2 | No undo; Details tab loses changes on tab switch |
| 4 | Consistency and Standards | 3 | SectionCard strong; scroll/save paradigm differs across tabs |
| 5 | Error Prevention | 3 | Good destructive guards; no character limits shown |
| 6 | Recognition Rather Than Recall | 3 | Icons+labels on tabs; Design tab recall-heavy |
| 7 | Flexibility and Efficiency | 2 | Drag-and-drop works; no keyboard shortcuts or bulk actions |
| 8 | Aesthetic and Minimalist Design | 3 | Clean restrained system; Design tab dense |
| 9 | Error Recovery | 2 | Generic error messages; no retry or rollback |
| 10 | Help and Documentation | 1 | SectionCard descriptions good; no tooltips/tour/docs |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: Pass. No AI slop detected. Clean restrained visual system, genuine domain vocabulary, no decorative patterns.

**Deterministic scan**: 2 findings, both false positives (hover-state gray-on-color, blockquote left-border).

## Priority Issues

### [P1] Details tab manual save inconsistency
Details uses "Save Changes" button while all other tabs autosave. Users will lose changes when switching tabs.
Fix: Convert to autosave with debounce.

### [P1] No undo mechanism
Autosave with 600ms debounce commits every edit immediately. No way to revert accidental changes to proposals worth thousands.
Fix: Extend Reset pattern; implement Cmd+Z with change stack.

### [P2] Design tab cognitive overload
6 groups, 20+ color pickers, 6+ font selectors all visible simultaneously. Densest UI in the app.
Fix: Collapsible sections, section-jump nav.

### [P2] Pages vs Text tab redundancy
Both tabs edit the same text page data through different interfaces. Confusing which is authoritative.
Fix: Merge or clearly differentiate.

### [P3] No proposal completion indicator
9 tabs with no visual signal of done/needs-attention. No progress tracking.
Fix: Tab badges or sidebar checklist.

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts. No bulk actions. Save-as-Template popover lacks Escape dismiss. Pages/Text redundancy wastes time.

**Jordan (First-Timer)**: 9-tab bar intimidating with no guidance. "Decision" and "Packages" not self-explanatory. No onboarding tour. No guided share flow.

## Minor Observations
- Analytics tab py-8 vs py-6 everywhere else
- Save-as-Template popover missing click-outside-to-close
- Tab underline floats at lg: breakpoint (parent border-b-0)
- ProposalCard.tsx is dead code
- decision/page.tsx casts Proposal to Record for require_signature
