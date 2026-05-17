# Funnel Planner — Funnelytics-style planning canvas

## Context

The user wants a Funnelytics-style **funnel planning tool** in AgencyViz: drag-and-drop canvas where they map a marketing funnel (traffic sources → landing pages → offers → upsells → actions) with optional **manually entered** metrics per node (visitors, conversion %, revenue) — purely for presenting plans to clients. **No real analytics, no tracking script, no warehouse hookup.**

The codebase already runs a near-identical canvas: the Creative Review whiteboard ([components/admin/feedback/board/FeedbackBoard.tsx](components/admin/feedback/board/FeedbackBoard.tsx)) is built on `@xyflow/react` with custom nodes, edges, sticky notes, shapes, debounced position saves, and a public share-token viewer at [app/whiteboard/[token]/page.tsx](app/whiteboard/%5Btoken%5D/page.tsx). Most of the canvas plumbing is free.

This plan ships a **standalone feature** (own DB table, own admin page, own share route) rather than overloading the feedback board, because the data model (funnel-specific node types + manual metrics) and the audience (presented *to* a client, not collected *from* them) are different enough that conflating them would muddy both products.

## Approach

Build `/funnels` as a parallel feature to `/feedback`, copying the canvas shell and swapping in funnel-specific node types and a metrics overlay. Reuse the React Flow setup, the context/provider pattern, the share-token public viewer, and the shape/edge persistence — only the node taxonomy and the metrics panel are new.

### Phase 1 — Schema + scaffolding

New Supabase tables (mirror the feedback shape, scoped by `company_id`):

- `funnels` — id, company_id, name, description, share_token, cover/branding fields, created/updated timestamps
- `funnel_nodes` — id, funnel_id, node_type (enum below), label, position (x, y), width/height, style JSON, **metrics JSON** (`{ visitors, conversion_rate, revenue, cost, notes }` — all optional, free-form)
- `funnel_edges` — id, funnel_id, source_node_id, target_node_id, label, style JSON (color, dashed, animated)
- `funnel_notes` — sticky notes (copy of `feedback_board_notes`)
- `funnel_shapes` — decorative shapes (copy of `feedback_board_shapes`)

`node_type` enum: `traffic_source`, `page`, `email`, `sms`, `offer`, `upsell`, `downsell`, `event`, `action`, `decision`, `goal`, `external`. Each carries an `icon` field so users can pick a platform icon (Facebook, Google, YouTube, TikTok, Stripe, etc.) without us hardcoding the taxonomy.

Types in new file [lib/types/funnel.ts](lib/types/funnel.ts), mirroring [lib/types/feedback.ts](lib/types/feedback.ts).

### Phase 2 — Admin canvas

- [app/funnels/page.tsx](app/funnels/page.tsx) — list/grid page, copy structure from [app/feedback/page.tsx](app/feedback/page.tsx).
- [app/funnels/[id]/page.tsx](app/funnels/%5Bid%5D/page.tsx) — editor, wraps the canvas.
- [components/admin/funnels/board/FunnelBoard.tsx](components/admin/funnels/board/FunnelBoard.tsx) — fork of [components/admin/feedback/board/FeedbackBoard.tsx](components/admin/feedback/board/FeedbackBoard.tsx), swap `nodeTypes` registration.
- [components/admin/funnels/board/FunnelBoardContext.tsx](components/admin/funnels/board/FunnelBoardContext.tsx) — fork of `FeedbackBoardContext`, swap CRUD methods to the new tables.
- [components/admin/funnels/board/nodes/](components/admin/funnels/board/nodes/) — one component per `node_type`, reusing `NodeHandles`, `StatusDot`, `CommentBadge` from [components/admin/feedback/board/nodes/nodeConfig.tsx](components/admin/feedback/board/nodes/nodeConfig.tsx).
- A **node palette sidebar** with draggable icons grouped by category (Traffic / Pages / Offers / Communication / Events). Icons primarily from lucide-react; add a small set of brand SVGs (Facebook, Google, YouTube, TikTok, Instagram, Stripe, Mailchimp) in [public/icons/brands/](public/icons/brands/) — no new library needed.

### Phase 3 — Manual metrics overlay

Each node carries a `metrics` JSON blob. The node component renders a compact metrics strip below the label (e.g. `1,200 visitors · 8% CVR · $4,800`). Clicking a node opens a side drawer (reuse the existing drawer/sheet pattern from the review editor) with editable fields for visitors, CVR, revenue, cost, and freeform notes.

Auto-computed totals on edges where source has `visitors` and target has `conversion_rate` (e.g. edge label `"→ 96 conversions"`) — purely a display calc, nothing persisted. A toggle in the top toolbar shows/hides metric overlays so the canvas can be presented "clean" or "with numbers."

### Phase 4 — Client share view

- [app/funnel/[token]/page.tsx](app/funnel/%5Btoken%5D/page.tsx) — public viewer, fork of [app/whiteboard/[token]/page.tsx](app/whiteboard/%5Btoken%5D/page.tsx).
- [app/api/funnel/[token]/route.ts](app/api/funnel/%5Btoken%5D/route.ts) — token-resolved GET, mirror of [app/api/whiteboard/[token]/route.ts](app/api/whiteboard/%5Btoken%5D/route.ts).
- Read-only React Flow, no handles, pan/zoom only. Optional "fit to screen" and a print-to-PDF route reusing html2canvas (already a project dep).

## Files to create

- [lib/types/funnel.ts](lib/types/funnel.ts)
- Supabase migration adding 5 tables + the `get_funnel_data(p_token)` RPC (mirror `get_whiteboard_data`)
- [app/funnels/page.tsx](app/funnels/page.tsx), [app/funnels/[id]/page.tsx](app/funnels/%5Bid%5D/page.tsx)
- [app/funnel/[token]/page.tsx](app/funnel/%5Btoken%5D/page.tsx), [app/api/funnel/[token]/route.ts](app/api/funnel/%5Btoken%5D/route.ts)
- API routes under [app/api/funnels/](app/api/funnels/) for CRUD (funnel, nodes, edges, notes, shapes)
- [components/admin/funnels/](components/admin/funnels/) — board, context, node components, palette, metrics drawer

## Files to reuse / reference (do not modify)

- [components/admin/feedback/board/FeedbackBoard.tsx](components/admin/feedback/board/FeedbackBoard.tsx) — canvas shell template
- [components/admin/feedback/board/FeedbackBoardContext.tsx](components/admin/feedback/board/FeedbackBoardContext.tsx) — provider pattern, debounced save pattern
- [components/admin/feedback/board/nodes/nodeConfig.tsx](components/admin/feedback/board/nodes/nodeConfig.tsx) — `NodeHandles`, badges, status pills
- [components/admin/feedback/board/edges/](components/admin/feedback/board/edges/) — labeled edge component
- [app/whiteboard/[token]/page.tsx](app/whiteboard/%5Btoken%5D/page.tsx) — public viewer pattern, guest identity, branding
- [lib/types/feedback.ts](lib/types/feedback.ts) — type structure to mirror
- [lib/supabase-server.ts](lib/supabase-server.ts), [lib/api-auth.ts](lib/api-auth.ts) — standard API auth pattern

## Verification

1. `npm run build` — must pass with new TypeScript types and routes.
2. Create a funnel from `/funnels`, drag 5+ node types onto the canvas, connect with edges, save, refresh page → state persists.
3. Add manual metrics to two connected nodes → edge label shows computed conversion count; toggle metrics off → canvas renders clean.
4. Generate share link, open `/funnel/[token]` in a private window → board renders read-only, no handles visible, no editing affordances.
5. Verify multi-tenancy: a second company's user cannot see funnel #1 in their list or load it by id (RLS / company_id scoping in API routes).
6. Print/export the public view to PDF via html2canvas → produces a presentable single-page render.

## Effort estimate

Roughly **3–5 days** of focused work, since ~70% of the canvas mechanics are already solved in the feedback board. Most of the time goes into: node-type taxonomy + visual design, the brand-icon set, the metrics drawer UX, and the migration + RPC.
