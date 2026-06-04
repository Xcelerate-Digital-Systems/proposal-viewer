---
name: AgencyViz
description: The agency toolbox. Proposals, quotes, campaigns, and integrations in one workspace.
colors:
  primary: "#017C87"
  primary-hover: "#016670"
  primary-tint: "#E6F5F3"
  ink: "#1E2432"
  prose: "#4B5563"
  dim: "#6B7280"
  faint: "#8C8C8C"
  surface: "#F5F5F5"
  edge: "#EFEFEF"
  edge-strong: "#E5E7EB"
  edge-hover: "#D5D5D5"
  surface-dark: "#043946"
  surface-dark-border: "#01434A"
  surface-dark-hover: "#013036"
  surface-dark-deep: "#01282e"
  surface-dark-accent: "#8AD9D1"
  accent-feedback: "#9333EA"
  accent-feedback-tint: "#FAF5FF"
  status-test: "#B45309"
  status-test-tint: "#FFFBEB"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.54
  detail:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "#DC2626"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
---

# Design System: AgencyViz

## 1. Overview

**Creative North Star: "The Precision Instrument"**

AgencyViz is a tool that disappears into the work. Every element is calibrated; nothing is decorative. The interface exists to make an agency's deliverables look good, not to show off its own UI. Chrome recedes; content commands attention.

The system speaks with the confidence of a tool that knows what it does. Copy is direct, surfaces are clean, and every element earns its pixel. Density follows the task: a campaign board with 30 assets needs tight rows; an empty proposal editor needs breathing room.

This is not a generic SaaS dashboard. It is not assembled from a kit (no Bootstrap, no Material defaults). It is not playful (no illustrations, no cartoon-ish rounded UI). It is not enterprise-dense (no cramped tables, no tiny text). It sits in the narrow band between authored minimalism and functional density, matching the quality agencies sell to their own clients.

**Key Characteristics:**
- Restrained color strategy: tinted neutrals with one teal accent at 10% or less
- Single font family (Manrope) in multiple weights for all hierarchy
- Flat surfaces at rest; shadows earned by state changes
- Desktop-first admin; mobile only for public-facing viewers
- Semantic token vocabulary over arbitrary values

## 2. Colors

A restrained palette anchored by a single saturated teal (#017C87), deployed on action surfaces only. Everything else is neutral.

### Primary
- **Teal** (#017C87): CTAs, links, focus rings, active tab indicators, selected states on light surfaces. The only saturated color in the admin UI.
- **Teal Hover** (#016670): Darkened primary for hover/pressed states.
- **Teal Tint** (#E6F5F3): Pale wash for selected-row backgrounds, hover states on light surfaces. Never used as a standalone surface.

### Secondary
- **Feedback Purple** (#9333EA): Color-codes the Campaigns/Feedback section and AI generation badges. Used in icon/text contexts only, never as a surface fill.
- **Feedback Purple Tint** (#FAF5FF): Background wash for purple-coded pills and indicators.

### Neutral
- **Ink** (#1E2432): Primary text. Near-black with a cool blue undertone.
- **Prose** (#4B5563): Secondary text. Body copy, descriptions, metadata.
- **Dim** (#6B7280): Tertiary text. Supplementary labels, timestamps.
- **Faint** (#8C8C8C): Quaternary text. Placeholders, disabled text, inactive icons.
- **Surface** (#F5F5F5): Background for recessed areas (Kanban column wells, card interiors, input backgrounds).
- **Edge** (#EFEFEF): Default border color. Dividers, card outlines, separator lines.
- **Edge Strong** (#E5E7EB): Emphasized borders. Form inputs, table headers, active section dividers.
- **Edge Hover** (#D5D5D5): Border color on hover states.

### Dark Surface (Sidebar Cluster)
- **Surface Dark** (#043946): Primary dark background (sidebar, dark modals).
- **Surface Dark Border** (#01434A): Dividers on dark surfaces.
- **Surface Dark Hover** (#013036): Hover background on dark surfaces.
- **Surface Dark Deep** (#01282e): Dropdown/popover background on dark surfaces.
- **Surface Dark Accent** (#8AD9D1): Bright text/icon accent on dark surfaces.

### Named Rules
**The One Voice Rule.** The teal primary is used on 10% or less of any given screen. Its rarity is what makes it a signal. When everything is teal, nothing is.

**The Neutral Default Rule.** Every new surface starts neutral (white, Surface, Edge). Color is added only when it carries meaning: a status, an action, a selection. Decorative color is prohibited.

## 3. Typography

**Display + Body Font:** Manrope (with system sans-serif fallback)
**Annotation Font:** Caveat (handwriting, used only in whiteboard/sketchy UI)

**Character:** One geometric sans across all hierarchy levels. Weight and size do all the work. The result is clean without being clinical: Manrope's slightly rounded terminals soften the precision without introducing warmth.

### Hierarchy
- **Display** (600, 17px, 1.3 line-height, -0.01em tracking): Page titles, project names. The font-display variable is an alias of Manrope, not a separate typeface.
- **Body** (400, 14px / text-sm, 1.5 line-height): Prose, descriptions, form labels.
- **Caption** (500, 13px, 1.54 line-height): Secondary labels, tab text, card metadata.
- **Detail** (500, 11px, 1.45 line-height): Timestamps, badge counts, inline metadata.
- **Label** (600, 10px / text-2xs, 1.4 line-height): Pill badges, status indicators, tiny uppercase labels. 10px is the floor; nothing goes smaller.

### Named Rules
**The Single Family Rule.** Manrope carries everything: headings, body, labels, buttons, data. Weight contrast (400 vs 600 vs 700) creates hierarchy, not font-family switching. The only exception is Caveat for handwritten-style annotations on the whiteboard.

## 4. Elevation

Tonal layering with earned shadows. Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus). The sidebar uses color to separate from the content area, not shadow.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgba(20,20,40,0.04), 0 4px 16px rgba(20,20,40,0.04)`): Default card resting state. Barely visible; just enough to lift off the surface background.
- **Card Soft** (`0 1px 2px rgba(20,20,40,0.04), 0 2px 8px rgba(20,20,40,0.04)`): Lighter variant for less prominent cards.
- **Card Hover** (`0 2px 4px rgba(20,20,40,0.06), 0 8px 20px rgba(20,20,40,0.06)`): Applied on hover/focus. Paired with `-translate-y-0.5` for a subtle lift.
- **Modal** (`0 24px 48px rgba(20,20,40,0.18)`): Floating dialogs and modals. High elevation, dark enough to establish a clear layer.
- **Divider** (`0 1px 0 rgba(20,20,40,0.05)`): Hairline under sticky headers. A shadow instead of a border so it doesn't shift layout.
- **Popover** (`0 10px 40px -12px rgba(15,23,42,0.25), 0 4px 12px -4px rgba(15,23,42,0.08)`): Dropdown menus, tooltips, floating UI. Cooler slate base for a clinical look.

All shadows use the same `rgba(20,20,40, X)` base palette (dark indigo-gray) so cards sit in the same shadow family. The difference is depth, not hue.

### Named Rules
**The Earned Shadow Rule.** No surface has a shadow at rest unless it is a card or a floating element. Shadows appear on hover (card-hover), on float (modal, popover), or on sticky position (divider). A flat surface that gains shadow on interaction communicates "I responded to you."

## 5. Components

### Buttons
- **Shape:** Gently curved (8px radius, `rounded-lg`)
- **Primary:** Teal background (#017C87), white text. Heights: sm=32px, md=40px, lg=48px. Padding: sm=12px, md=16px, lg=24px horizontal.
- **Hover:** Darkened teal (#016670). No shadow, no scale.
- **Focus:** 2px ring in `primary/40` with 1px offset.
- **Secondary:** White background, ink text, edge border. Hover shows paper background and stronger border.
- **Outline:** Transparent background, teal text, teal/30 border. Hover fills with teal tint.
- **Ghost:** Transparent background, ink text. Hover shows edge background. Used in toolbars and inline actions.
- **Ghost on Dark:** For sidebar/dark-surface contexts. White/60 text, hover brightens to white with dark-hover background.
- **Danger:** Red-600 background, white text. For destructive actions only.
- **Link:** No background, no border, no height. Teal text with underline on hover. Used inline.
- **Loading:** Replaces left icon with a spinning Loader2. Button stays disabled during loading.

### Cards / Containers
- **Corner Style:** Generously curved (16px radius, `rounded-2xl`)
- **Background:** White (#FFFFFF)
- **Shadow Strategy:** Card shadow at rest, Card Hover on hover (with -0.5px translateY lift). See Elevation.
- **Border:** None by default. Edge border only on secondary/structural containers (pages lists, embed code blocks).
- **Internal Padding:** 12px (cards), 20px (panels/sections).

### Inputs / Fields
- **Style:** White background, edge-strong border, 8px radius.
- **Focus:** 2px teal/30 ring + teal border color. No glow, no shadow.
- **Error:** Not styled as a global pattern; handled per-field with red-500 text below the input.
- **Disabled:** 50% opacity.

### Navigation
- **Sidebar (Admin):** Fixed-width dark surface (#043946). Bright accent text (#8AD9D1) for active items. Ghost-on-dark hover states. Lucide icons at 18px. Section dividers use surface-dark-border.
- **Tab Bars (Project):** Inline horizontal tabs. Active: teal text + 2px teal bottom border. Inactive: faint text, transparent border, ink text on hover. Lucide icons at 15px paired with text labels.

### Status Dropdown
- **Shape:** Compact pill with colored background tint, colored text, and colored border. Each status has a unique color assignment (gray/teal/blue/amber/orange/emerald/red).
- **Interaction:** Click opens a portaled dropdown listing all statuses with color dots. Selection updates immediately.

### Toast
- **Shape:** Rounded card (16px radius), white background, colored left icon (emerald/red/blue), shadow-lg.
- **Position:** Fixed bottom-right, stacked vertically.
- **Action Variant:** Optional teal "Undo" button after the message text.
- **Duration:** 4s default, 6s when an action is present.

## 6. Do's and Don'ts

### Do:
- **Do** use the teal primary (#017C87) exclusively for interactive elements: buttons, links, focus rings, active indicators.
- **Do** use the semantic token vocabulary (`text-ink`, `text-dim`, `text-faint`, `bg-surface`, `border-edge`) instead of arbitrary Tailwind colors.
- **Do** use the `<Button>` primitive from `@/components/ui/Button` with its defined variants (primary/secondary/outline/ghost/danger/link) instead of inline `<button>` elements.
- **Do** pair card shadows with `-translate-y-0.5` on hover for the lift effect.
- **Do** use `rounded-2xl` (16px) for cards and modals, `rounded-lg` (8px) for buttons and inputs.
- **Do** use confirmation dialogs (`useConfirm`) before any destructive or irreversible action (delete, send emails).
- **Do** provide undo toasts for optimistic state changes that affect visible layout (Kanban moves, comment resolution).

### Don't:
- **Don't** use teal as a background fill on large surfaces. Its rarity is the signal.
- **Don't** introduce a second accent color. The purple (#9333EA) is scoped to Campaigns/AI badges and is not a general-purpose accent.
- **Don't** use generic SaaS dashboard patterns: white panels with blue accents, Bootstrap/Material defaults. (From PRODUCT.md: "AgencyViz should feel authored, not assembled from a kit.")
- **Don't** use playful or illustration-heavy UI. No cartoon-ish rounded elements, no Canva/Mailchimp energy. (From PRODUCT.md: "Agencies sell professionalism to their clients; the tool they use to do it should reflect that.")
- **Don't** use enterprise-dense layouts with cramped tables and tiny text. (From PRODUCT.md: "Information density is fine where it serves the task, but never at the cost of legibility or composure.")
- **Don't** add AI claims or "AI-powered" language anywhere in the UI. The app has no user-facing AI features.
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe on cards, alerts, or list items.
- **Don't** use gradient text, glassmorphism, or decorative motion.
- **Don't** use z-index values above 100 (toasts) in new code. The scale is: dropdown (50) > sticky (10) > modal-backdrop (40) > modal (50) > toast (100).
- **Don't** add fonts beyond Manrope (UI) and Caveat (annotations). Two families is the ceiling.
