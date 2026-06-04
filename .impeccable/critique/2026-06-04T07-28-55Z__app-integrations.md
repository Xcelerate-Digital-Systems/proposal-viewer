---
target: app/integrations
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-06-04T07-28-55Z
slug: app-integrations
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No confirmation after deployment ID copy reaches Looker Studio; GHL sync status unclear |
| 2 | Match System / Real World | 3 | Solid domain language; "Build Your Own, by Google" in Step 3 will confuse users |
| 3 | User Control and Freedom | 2 | GHL 33-dropdown mapping has no reset/undo; save is immediate |
| 4 | Consistency and Standards | 3 | Strong within admin; Meta card `bg-white shadow-card` vs GHL `bg-surface border` mismatch |
| 5 | Error Prevention | 2 | GHL save button always active even with no pipeline selected; raw error strings |
| 6 | Recognition Rather Than Recall | 3 | Inline setup steps, named pipeline stages, status pills with text |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no bulk mapping; no duplicate config across proposal/quote |
| 8 | Aesthetic and Minimalist Design | 2 | Admin is clean; marketing page is 40% too long with repeating content |
| 9 | Error Recovery | 2 | `decodeURIComponent(error)` shown raw; "Connection failed" with no guidance |
| 10 | Help and Documentation | 2 | Inline hints exist; no external docs links, no "Learn more" for concepts |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: The marketing page carries 3-4 AI slop signals. Nearly every section uses an identical uppercase eyebrow kicker (`text-xs font-semibold uppercase tracking-wider text-teal`). The stats bar fakes two of its three entries with icons instead of real metrics. The use case cards have decorative gradient rectangles that carry zero information. The testimonial from "Founding Agency, Account Manager" with initials "AM" and no real identity is manufactured social proof. The admin surfaces are clean — they read as authored functional UI.

**Deterministic scan**: 1 finding. `ai-color-palette` warning at `app/home/integrations/page.tsx:81` — a `from-violet-100 to-purple-50` gradient in the use cases section. This violet/purple gradient is a recognizable AI-palette tell. The other two use case gradients (`from-sky-100 to-cyan-50`, `from-emerald-100 to-teal-50`) are less flagrant but contribute to the same decorative-gradient-card pattern. The detector confirmed what the design review identified: the use case cards are AI-formula filler.

## Overall Impression

The admin surfaces are solid functional UI — the Meta connector card in particular is well-structured with clear state management. The Looker Studio setup page is workable but ends abruptly. The marketing page is the weakest surface: it repeats itself, fakes social proof, and falls into the "every section has an eyebrow + heading + paragraph + card grid" cadence. The GHL connector card is the biggest UX problem — 33+ configuration decisions in a single scrolling panel with no progressive disclosure.

## What's Working

1. **The passthrough diagram on the marketing page is excellent information design.** It communicates a technical architecture concept (zero data retention) in a visual that's immediately scannable. The three-step flow with the "Zero data retention" badge directly addresses the #1 trust concern for agencies connecting client ad data.

2. **The Meta connector card's three-state UI is clear and well-structured.** Disconnected (CTA), connected (list with account counts + relative timestamps), needs_reauth (amber warning) — each state is distinct, appropriately styled, and tells the user exactly what action is needed. The `formatRelativeTime` helper humanizes timestamps well.

3. **The Before/After section uses concrete, specific pain points.** "Monday mornings spent exporting CSVs from Meta" and "Copy-paste errors in spreadsheets nobody catches" are real problems the target user recognizes. This is effective copy that avoids generic SaaS benefit language.

## Priority Issues

### [P1] GHL connector card is an unstructured configuration dump
The card presents pipeline selection, two full mapping tables (11 rows x 3-4 columns), workflow trigger, monetary sync toggle, and activity log in a single scrolling panel with only `<hr>` separators. This is 33+ configuration decisions with no progressive disclosure, no grouping, and no wizard flow. A first-time user opening this card has no idea where to start.

**Why it matters**: Account managers (the primary user) are not power users. They need to configure this once and forget it. The current UI makes that first configuration feel like operating a control panel. High abandonment risk.

**Fix**: Convert to stepped accordion sections: (1) Pipeline Selection, (2) Proposal Stage Mapping, (3) Quote Stage Mapping, (4) Advanced Options (workflow + monetary). Show one section at a time. Add a summary state when collapsed.

**Suggested command**: `/impeccable shape` the GHL mapping flow as a wizard, then `/impeccable craft` the implementation.

### [P1] Fake testimonial damages trust
Lines 338-355 on the marketing page show a quote from "Founding Agency, Account Manager" with initials "AM" and no real name, photo, or company. For B2B SaaS selling to agencies, social proof must be real or absent. A fabricated testimonial signals "we don't have real customers yet" to any experienced buyer.

**Why it matters**: The testimonial sits at a critical decision point in the page flow — between the feature details and the FAQ/CTA. It's where trust should peak. Instead it craters.

**Fix**: Remove the testimonial section entirely until a real customer quote is available. The page flows naturally from features to FAQ without it.

**Suggested command**: `/impeccable distill` to strip the section.

### [P2] Looker Studio setup journey ends without closure
After copying the deployment ID (Step 4), the user is expected to leave AgencyViz, go to Looker Studio, paste the ID, validate it, and complete setup there. There is no confirmation, no verification mechanism, no status update. The user has no way to know from AgencyViz whether their connection actually works.

**Why it matters**: The user's emotional journey ends mid-air. They've done 4 steps in AgencyViz and now face an unknown number of steps in a different product. No resolution.

**Fix**: Add a Step 5: "Verify your connection" with guidance on what to expect in Looker Studio, or a status indicator that updates when the first data request succeeds. At minimum, add a "What to expect" callout explaining the connector name and what the user should see.

**Suggested command**: `/impeccable harden` to add the verification step and edge case handling.

### [P2] Marketing page repeats itself across too many sections
"95+ fields" appears in: hero copy, stats bar, features section header, a features card, and the FAQ. The stats bar (3 items), connector bar (4 items), and features grid (9 items) communicate overlapping information. The page is approximately 40% longer than needed.

**Why it matters**: Repetition weakens each mention. By the third time a reader encounters "95+ fields," it reads as padding rather than emphasis. Section bloat increases scroll fatigue.

**Fix**: Cut the stats bar entirely (only one real stat). Reduce features grid from 9 to 5-6 cards. Cut or merge use cases into the Before/After section. Remove gradient decoration rectangles.

**Suggested command**: `/impeccable distill` to strip to essence.

### [P3] Meta and GHL connector cards have inconsistent visual treatment
Meta card: `bg-white rounded-2xl shadow-card`. GHL card: `bg-surface border border-edge rounded-2xl`. Same page, same purpose, different container styles. Meta uses `<section>` + `<header>` elements; GHL uses plain `<div>`. Meta header has `px-6 py-5`; GHL has `px-6 py-4`. Description specificity differs.

**Why it matters**: Users see these cards side by side in Settings → Integrations. Visual inconsistency suggests different authors, not a unified product.

**Fix**: Extract a shared `ConnectorCardShell` component for header, status, and body container. Standardize padding, background, and semantic elements.

**Suggested command**: `/impeccable polish` to align both cards.

## Persona Red Flags

**Dana (Agency Account Manager, 10+ clients, needs setup fast)**:
- Connects Meta in Settings → sees "Connected" with 3 ad accounts but no way to select/deselect individual accounts from this card. Account management happens... where?
- Navigates to `/integrations/looker-studio`, copies deployment ID, switches to Looker Studio. Instructions reference "Build Your Own, by Google" — confusing. No screenshots or visual aids.
- Manages 10+ clients. No batch workflow, no indication that one deployment ID works for all clients. Efficiency path is invisible.

**Jordan (First-Timer)**:
- Tab mockups in the "How it works" section have 8-10px text — illegible detail on standard displays.
- Hits the fake testimonial and immediately flags it as manufactured. Trust destroyed at decision point.
- No zero-commitment way to evaluate the feature (no demo, sandbox, or video walkthrough).

**Sam (Accessibility)**:
- `CopyDeploymentButton` is a raw `<button>` with no `aria-live` announcement for the copied state change. Screen reader user hears nothing.
- GHL toggle buttons (3x) use `ToggleRight`/`ToggleLeft` icons with no `aria-label`, no `role="switch"`, no `aria-checked`. Unlabeled controls.
- `StatusDot` component uses color-only to indicate sync status (teal/amber/red). No text label, no `aria-label`.
- `MockIntegrationsUI` on marketing page has no `aria-label` — screen readers read all mock UI text as real content.

## Minor Observations

- `CopyDeploymentButton` (Looker Studio page, line 75) uses an inline `<button>` instead of the `<Button>` primitive. CLAUDE.md requires the Button primitive for new code.
- Meta card disconnect button (line 243) is a raw `<button>` with hover states; GHL disconnect (line 385) uses the `<Button>` primitive. Inconsistency in the same panel.
- Marketing page `CTA_HREF` uses an absolute URL (`https://app.agencyviz.io/signup`) when signup is on but relative (`/pricing`) when off — fragile if domain differs.
- The 60 animated SVG paths (2x `FloatingPaths`, 30 each) with infinite framer-motion loops could cause frame drops on lower-end machines.
- GHL card has no empty state if the GHL account has no pipelines. The select dropdown shows only "Select a pipeline..." with zero options and no guidance.
- The violet/purple gradient on the third use case card (`from-violet-100 to-purple-50`) is an AI palette tell flagged by the detector.

## Questions to Consider

1. **Why is the Looker Studio setup page separate from the Settings connector cards?** The user connects Meta in Settings, then navigates to `/integrations/looker-studio` for the deployment ID. What if deployment ID + instructions appeared inline in the Meta connector card after connection, eliminating the second page entirely?

2. **Is a dropdown matrix the right pattern for GHL stage mapping, or should it be a visual pipeline mapper?** The user is mapping one pipeline to another — a spatial concept. A two-column drag-to-connect mapper would be dramatically easier to understand than 33 dropdowns.

3. **Does the integrations marketing page need to exist as a standalone surface?** With one connector available and one "coming soon," it's a single-feature page wearing an "Integrations" hat. A section on the main marketing page with a deep-dive expandable might be more honest and easier to maintain.
