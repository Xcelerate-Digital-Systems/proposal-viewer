---
target: app/funnel/[token]
total_score: 27
p0_count: 0
p1_count: 1
timestamp: 2026-06-04T21-25-08Z
slug: app-funnel-token
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Excellent loading/not-found states; no canvas position indicator or zoom-level readout |
| 2 | Match System / Real World | 3 | Canvas metaphor is natural; "People" metric label is unexplained domain jargon |
| 3 | User Control and Freedom | 3 | Full pan/zoom with sensible bounds; no keyboard shortcuts for reset-view or navigation |
| 4 | Consistency and Standards | 3 | Tokens and conventions consistent; Controls/MiniMap use `!important` overrides that feel heavier than the rest |
| 5 | Error Prevention | 3 | Read-only discipline prevents all mutations; expired-token state offers no recovery path |
| 6 | Recognition Rather Than Recall | 3 | Icons recognizable, metrics visible; no tooltips explain what anything means |
| 7 | Flexibility and Efficiency | 2 | Mouse/trackpad zoom only; no keyboard shortcuts, no fullscreen, MiniMap too small for large funnels |
| 8 | Aesthetic and Minimalist Design | 4 | Clean dot-grid, semantic color, minimal chrome — every element earns its pixel |
| 9 | Error Recovery | 2 | "Funnel not found" is clear but offers no next step; no in-canvas error handling post-load |
| 10 | Help and Documentation | 1 | Zero in-context help: no tooltips, no legend, no onboarding, no "?" affordance |
| **Total** | | **27/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: Clean pass. The surface avoids every AI slop tell: no side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no eyebrow kickers, no numbered section markers. The dot-grid canvas, single-family Manrope type, and restrained teal accent read as authored minimalism. The white-label branding (agency logo/colors/fonts in the header and loader) reinforces that this feels like the agency's tool, not a generic SaaS viewer.

**Deterministic scan**: Exit code 0 on the primary surface (`app/funnel/[token]/page.tsx`). Two warnings surfaced in broad component scans — both non-issues: (1) a blockquote `border-left: 3px` in `TextPage.tsx` (correct semantic styling, not part of this surface), (2) a comment-string `<img>` match in `FunnelStepNode.tsx` (false positive; the actual image has proper `alt`, `onError` fallback to Lucide icon). No actionable anti-pattern findings.

## Overall Impression

A clean, professional read-only canvas that does the hard things right: white-label branding, semantic metric coloring, read-only discipline, and a well-tuned loading experience. The aesthetic is agency-grade. The gap is everything around the canvas: zero help, no metric explanations, no accessibility support, no recovery guidance on error states. A client who already understands funnel planning will appreciate the polish. A client who doesn't will stare at colored circles and numbers with no guide.

## What's Working

1. **White-label branding is seamless.** Header uses the agency's `bgSecondary`, `font_heading`, `font_sidebar`, and logo. ViewerLoader does the same. The client sees their agency's identity, not AgencyViz. This is critical for trust in a B2B tool.

2. **Read-only discipline is thorough.** Every node is explicitly `draggable: false`, `selectable: false`, `connectable: false`. No hover overlays with delete/edit buttons leak into the public view. The canvas background is transparent to clicks. A guest cannot accidentally break anything — this respects the role boundary.

3. **Semantic color in BoardSummary.** Emerald for positive revenue/profit, rose for negative cost, ink for neutral. The stat pill at top-left gives an executive summary at a glance. Paired with per-node "People" metrics, the data layer communicates without decoration.

## Priority Issues

### [P1] No help or onboarding for first-time guests
**Why it matters**: A client who isn't fluent in funnel planning opens a canvas with colored circles, arrows, percentage labels, and a "People: 5,000" pill. There are no tooltips, no legend, no introductory text. The metrics vocabulary ("People", "conv", ROAS) assumes domain expertise. Confusion erodes the agency's credibility.
**Fix**: Add hover tooltips on BoardSummary stats ("ROAS — return on ad spend; higher is better"). Add a subtle floating legend (node types + metric definitions) that dismisses on first interaction. Consider a one-time react-joyride tour for first visits (localStorage flag per funnel).
**Suggested command**: `/impeccable onboard app/funnel/[token]`

### [P2] "People" metric label is ambiguous
**Why it matters**: The FunnelStepNode metrics pill shows "People 5,000" — but "People" could mean visitors, unique visitors, qualified leads, or sessions. A client reading this metric has no way to know what's being counted. The label choice came from Funnelytics parity, but Funnelytics has a legend panel; this viewer doesn't.
**Fix**: Rename to "Visitors" (the underlying data is `forecastVisitors`). If other step types measure different populations, allow per-step metric labels set by the editor and display them here.
**Suggested command**: `/impeccable clarify app/funnel/[token]`

### [P2] Accessibility is absent
**Why it matters**: React Flow canvas nodes have no ARIA labels. Keyboard-only users can reach the Controls buttons but cannot navigate between nodes. BoardSummary metrics are visual pills with no table structure. Color is the sole indicator of metric polarity (emerald vs. rose) — colorblind guests lose meaning. Screen readers announce nothing about the funnel structure.
**Fix**: Add `aria-label` on each node (`"Facebook Ads stage — 10,000 visitors"`). Wrap BoardSummary in a `role="table"` with proper headers. Pair color with a directional icon or prefix (up-arrow for positive, down-arrow for negative). Add visible focus indicators on interactive elements.
**Suggested command**: `/impeccable audit app/funnel/[token]`

### [P3] Not-found state offers no recovery path
**Why it matters**: "This link may have expired or been revoked" is clear but terminal. The guest has no next step: no contact link, no way to request a new share token, no hint about who to reach out to. A moment of mild anxiety ("Did I break something?") with no resolution.
**Fix**: Add a line: "Contact your agency to request a new link." If the funnel's company has a public contact email, surface it. If not, the generic copy is enough.
**Suggested command**: `/impeccable harden app/funnel/[token]`

### [P3] Controls and MiniMap styling is heavier than the canvas aesthetic
**Why it matters**: The React Flow Controls and MiniMap use `!bg-white !border !border-edge !shadow-sm !rounded-lg` — `!important` overrides that feel boxier than the rest of the minimal surface. The MiniMap at 140x90px is too small to be useful for large funnels (50+ nodes). Minor visual inconsistency, but noticeable against the otherwise clean canvas.
**Fix**: Soften Controls to ghost-style (transparent bg, ink/40 icons, shadow only on hover). Increase MiniMap to 180x110px. Use `border-edge/50` instead of full `border-edge` for both.
**Suggested command**: `/impeccable polish app/funnel/[token]`

## Persona Red Flags

**Jordan (First-Timer)**: Opens the funnel and sees colored circles, arrows, percentage labels, and "People: 5,000" pills. No legend, no tooltips, no introductory text. Doesn't know what node colors mean, what "People" measures, what the flow direction implies, or why some nodes are circles and others are page mockups. Will likely screenshot it and ask the agency "what am I looking at?" — defeating the purpose of self-serve viewing.

**Sam (Accessibility-Dependent)**: Cannot navigate the funnel at all with keyboard-only. React Flow nodes have no ARIA labels. BoardSummary metrics are visual-only. Color is the sole indicator of positive/negative values (emerald/rose). Sticky notes and shapes are SVG with no semantic markup. The entire surface is invisible to screen readers beyond the header bar.

**Riley (Stress Tester)**: Large funnel (50+ nodes) — MiniMap is too small to orient, edge labels overlap on dense graphs, node labels truncate at 180px with no expand-on-hover. Very long funnel names in the header `truncate` without a tooltip showing the full name. If the API fetch fails after partial load (network drop mid-request), the catch block sets `notFound: true` — which is misleading (it's a network error, not a missing funnel).

## Minor Observations

- **FitView padding is static** (`0.2`). Small funnels (2-3 nodes) appear tiny in the viewport; dynamic padding based on node count would fill the canvas better.
- **Edge label overlap**: Dense funnels with many labeled edges will have overlapping pills. The `LABEL_BIAS = 0.4` mitigates but doesn't solve. No collision detection.
- **No node count or complexity indicator**: A guest viewing a 100-node funnel has no sense of scale from the header. A subtle "42 steps" badge would set expectations.
- **The catch block treats network errors as "not found"**: Line 70-74 sets `setNotFound(true)` for any fetch failure, not just 404s. A transient network error shows "Funnel not found" instead of "Something went wrong, try refreshing."
- **MiniMap node colors are low-contrast**: `fill-white stroke-ink/40` on a #FAFAFA background is nearly invisible. Slightly more fill contrast would make the MiniMap usable as a navigation tool.

## Questions to Consider

- What if the viewer had a "present" mode — a guided walk-through that steps through the funnel stage by stage, zooming into each node with narration? The agency sets the tour; the client plays it. It would turn a static canvas into a storytelling tool.
- Should the guest be able to react to or comment on the funnel? Even a simple "looks good" / "I have questions" response button would close the loop for the agency and give the client agency.
- The BoardSummary chip shows Revenue/Cost/Profit/ROAS — but these are projections, not actuals. Is that clear to the guest? A "Projected" prefix or a subtle label ("based on funnel model") would set expectations and prevent the client from treating forecasts as commitments.
