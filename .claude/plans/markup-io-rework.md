# AgencyViz Feedback Tool — markup.io-style rework

## Status (2026-04-23)

| PR | Status | Commit |
|----|--------|--------|
| 1 — Composer visual + consolidate highlight popover | ✅ Shipped | `a0fc4fa` |
| 2 — Highlight badges + click-to-reopen | ✅ Shipped | `cfaea57` |
| 3 — Per-comment priority | ✅ Shipped | `527aa4a` |
| 4 — Draw + video action icons in composer | ✅ Shipped | `9c83b43` |
| 5 — Attach Files modal + attachment-persistence fix | ✅ Shipped | `528a905` |
| 6 — Note to reviewers | ✅ Shipped | `89541ff` |
| 7 — Complete-your-feedback flow | ✅ Shipped | `605e388` |
| 8 — Reviewer top chrome + Comment / Browse mode | ✅ Shipped | `89c109e` |
| 8b — Pause new comments + status pill | ✅ Shipped | `fa7192c` |
| 9 — Video feedback recording | ✅ Shipped | `5ff5449` |
| 10 — Emoji picker rework (emoji-mart) | ✅ Shipped | `42afee6` |
| Widget priority UI (PR 3 widget parity) | ✅ Shipped | `06b590f` |
| Admin completions feed (PR 7 follow-up) | ✅ Shipped | `883ad84` |
| 4b — Collapsed pill composer | ⏸ Deferred (user said no) | — |
| 8c — Left sidebar comment list + device toggles | ⏸ Deferred (low value for our content model) | — |
| Widget video recording UI | ⏸ Deferred | — |

Bonus fix that predated the rework: email viewer sticky client toggle (`3072b6f`).

## Context

The current Creative Review tool is functional but visually utilitarian: pin comments open a fixed-width form popover, the Feedback tab modal is read-only, highlight comments use a parallel popover component, and there's no project-level onboarding/completion flow. Screenshots shared 2026-04-22 establish markup.io as the visual target.

This plan sequences the rework into independent PRs so work can land incrementally without a long-lived branch. Each PR is scoped to merge on its own and revert cleanly.

**Agreed in this session (2026-04-22):**
- Composer input is a **plain textarea** — no rich text, no formatting toolbar (dead or live), no @mentions.
- **Per-comment priority** (High / Medium / Low / None) is in scope.
- Consolidate `PendingHighlightPopover` into the same composer used for pins.
- Highlight UX mirrors markup.io (drag-select → yellow mark → same composer → numbered badge → click to reopen).

**Out of scope (explicitly deferred):**
- Rich-text formatting / TipTap in the composer.
- @mentions of team members.

---

## Two surfaces to keep in parity

Unlike markup.io (which only has one feedback view), AgencyViz has **two independent review surfaces** that need to match:

1. **Feedback window** — the hosted page at `/review/[token]`, the public whiteboard at `/whiteboard/[token]`, and the admin-side item viewer at `/feedback/[id]/items/[itemId]`. Built with React + Next.js App Router. Shared UI lives in `components/feedback/`. Comments go through Supabase (via admin auth) or `/api/review/[token]/comments` (public).

2. **Embedded webpage widget** — a vanilla JS script served from `/api/review-widget/[token]/script`, injected on the client's live website via a `<script>` tag. All UI is built imperatively in `app/api/review-widget/[token]/script/parts/*.ts`. Comments go through `/api/review-widget/[token]/comments`.

**Parity rule:** visual changes that affect the composer, drawing tools, emoji picker, attach modal, priority selector, and highlight behaviour must be implemented on **both surfaces**. Chrome-level features (top bar, left sidebar, project-level modals like note-to-reviewers and complete-feedback) live only in the feedback window.

Each PR below tags whether it touches `[window]`, `[widget]`, or `[both]`.

---

## Already shipped this session
- Email viewer top-toggle sticky fix — [components/admin/feedback/EmailMockupPreview.tsx:64-68](components/admin/feedback/EmailMockupPreview.tsx#L64-L68). Not part of the rework; unrelated bug.

---

## PR 1 — Composer visual + consolidate highlight popover `[both]`

**Goal:** Match screenshot 1 (the speech-bubble composer) *minus* the formatting toolbar; drop `PendingHighlightPopover` and route text selections through the same component with an optional quoted-text badge above the textarea.

**Changes:**
- [components/feedback/comments/PendingPinForm.tsx](components/feedback/comments/PendingPinForm.tsx) — restyle: white card, `rounded-2xl`, softer shadow, paperclip icon button (left of Post), rounded teal Post button. Keep the textarea. Accept optional `quotedText?: string` prop; when present, render a yellow-left-bordered block above the textarea.
- [components/feedback/PendingPinPopover.tsx](components/feedback/PendingPinPopover.tsx) — add downward-pointing tail (CSS pseudo-element on the wrapper, positioned based on `usePopoverPosition`'s placement). Accept and forward `quotedText?`.
- [components/feedback/PendingHighlightPopover.tsx](components/feedback/PendingHighlightPopover.tsx) — **delete**. Its only differentiator was the quote badge, which now lives in `PendingPinForm`.
- [components/feedback/FeedbackDetailView.tsx:518-534, :823-838](components/feedback/FeedbackDetailView.tsx#L518-L534) — swap both `PendingHighlightPopover` sites for `PendingPinPopover` with `quotedText={pendingHighlight.text}`. Remove the import.

**Widget-side equivalent:** restyle `app/api/review-widget/[token]/script/parts/annotation-form.ts` and `highlight-mode.ts` to match the same card shape — white rounded card, paperclip placeholder (widget doesn't have attachments yet but leave room), teal rounded Post button, downward tail. Quote block at top when posting from highlight mode (already partially present in `highlight-mode.ts`).

**Verify:** pin a comment on the feedback window → card matches screenshot 1 (minus toolbar). Select text → same card opens with the selected text quoted above. Install widget on a real page → pin/box/text/highlight → same visual.

---

## PR 2 — Markup.io highlight badges + click-to-reopen `[both]`

**Goal:** Existing text highlights show a numbered badge at the end of the highlighted range; clicking the badge (or the highlight itself) opens the comment thread. Match markup.io's "thread number anchors the annotation" pattern.

**Changes:**
- [components/feedback/tools/HighlightOverlay.tsx](components/feedback/tools/HighlightOverlay.tsx) — after wrapping each range in a `<mark>`, append a small numbered badge span (absolute/inline) showing `comment.thread_number`. Style: solid teal circle, 16px, white bold digit, pointer cursor.
- Reuse the existing `onHighlightClick` callback — the badge click already reaches it.
- Ensure `thread_number` is assigned to `text_highlight` comments at insert time. Check admin-side [app/feedback/[id]/items/[itemId]/page.tsx:218-225](app/feedback/[id]/items/[itemId]/page.tsx#L218-L225) — currently `thread_number` is only set when `pinX != null`. Needs a branch so highlight comments also get a number. Widget side was handled in last session ([app/api/review-widget/[token]/comments/route.ts:111](app/api/review-widget/[token]/comments/route.ts#L111)).

**Widget-side equivalent:** the widget doesn't render saved highlights today. Add a `renderHighlights()` pass in `annotations.ts` that walks each `text_highlight` comment's `highlight_element_path` + `highlight_start/end`, finds the matching node, wraps the range in a `<mark class="aviz-hl">` with a numbered badge, and restores on `refresh()`. Same click behaviour → scroll to thread in panel.

**Verify:** leave two text highlights on the feedback window → yellow mark with `#1` / `#2` at the end → click either, its thread opens. Same on the widget.

---

## PR 3 — Per-comment priority `[both]`

**Goal:** High / Medium / Low / None selector on every comment, badge on comment rows, filter on Feedback tab.

**Schema (Supabase migration):**
```sql
alter type public.review_comment_priority add value ... -- actually create enum:
create type review_comment_priority as enum ('high', 'medium', 'low', 'none');
alter table review_comments add column priority review_comment_priority not null default 'none';
create index review_comments_priority_idx on review_comments(review_item_id, priority) where priority != 'none';
```

**Types:**
- [lib/types/feedback.ts](lib/types/feedback.ts) — add `priority: 'high' | 'medium' | 'low' | 'none'` to `FeedbackComment`.

**UI:**
- New [components/feedback/comments/PrioritySelector.tsx](components/feedback/comments/PrioritySelector.tsx) — dropdown matching screenshot 3 (red ▲ / amber ● / green ▼ / blue ✓).
- [components/feedback/comments/PendingPinForm.tsx](components/feedback/comments/PendingPinForm.tsx) — add priority state + selector button next to paperclip; pass to `onSubmit`.
- Comment insert callbacks (`submitComment` in admin items page + `FeedbackDetailView.handleSubmitComment` + widget `postComment`) — thread `priority` through to DB insert.
- [components/feedback/comments/CommentThread.tsx](components/feedback/comments/CommentThread.tsx) — render priority badge next to author name.
- [app/feedback/[id]/feedback/page.tsx](app/feedback/[id]/feedback/page.tsx) — add priority filter pill row alongside Open/Resolved.

**API passthrough:**
- [app/api/review-comments/route.ts](app/api/review-comments/route.ts) and `/api/review-widget/[token]/comments/route.ts` — accept + store `priority`.

**Widget-side equivalent:** widget composer (`annotation-form.ts`, `text-mode.ts`, `highlight-mode.ts`) gets the same priority selector. `icons.ts` gets priority icons. POST body in `postComment(...)` sends `priority`. Saved priorities show in the side panel's comment list (`panel.ts`).

**Verify:** mark a comment High → red badge on row → filter "High" on Feedback tab shows only that comment. Same on widget (priority reflected in panel).

---

## PR 4 — Collapsed pill composer with action icons `[both]`

**Goal:** Match screenshot 2 — pill-shaped "Add comment here" input with inline icons (emoji, draw, attach, video, priority). Expands into the screenshot 1 speech-bubble on focus.

**Changes:**
- New [components/feedback/comments/CompactComposer.tsx](components/feedback/comments/CompactComposer.tsx) — pill container with textarea (1 row, auto-grows on focus) + icon row: smile (opens `EmojiPicker`), pencil (toggles drawing mode — reuses `FeedbackToolbar`'s `changeFeedbackMode`), paperclip (opens attach modal from PR 5), video (placeholder, disabled), gray circle (priority dropdown from PR 3).
- Swap `PendingPinForm` to use `CompactComposer` in the expanded/focused state.
- Drawing icon → opens the `FeedbackToolbar` sub-row from screenshot 5 (square/circle/line/arrow/pen/marker/color/blind/undo/redo) — most of these map to existing `FeedbackMode` values; new ones (circle, line, pen, marker, blind/hide) need new modes in `FeedbackMode` + new draw handlers in `DrawingOverlay`.

**Depends on:** PR 3 (priority selector), PR 5 (attach modal), PR 1 (composer baseline).

**Verify:** resting input is a single-line pill with icons. Click emoji → picker opens. Click pencil → drawing toolbar opens. Focus textarea → expands to full speech-bubble with Post button.

---

## PR 5 — Attach Files modal `[both]`

**Goal:** Replace the inline `AttachmentPicker` preview row with a proper modal (screenshot 6) when the paperclip is clicked from the collapsed pill.

**Changes:**
- New [components/feedback/comments/AttachFilesModal.tsx](components/feedback/comments/AttachFilesModal.tsx) — centred modal, dashed drop-zone with file illustration, supported-formats copy, Browse button.
- Reuse the existing `/api/review-comments/attachments` POST endpoint.
- Keep the inline preview list below the composer once files are attached (so users see what they've added before posting).

**Verify:** paperclip opens modal → drag-drop a PNG → modal closes, preview appears in composer → post → comment has attachment.

---

## PR 6 — Note to reviewers (project-level) `[window]`

**Goal:** Screenshot 7 — project owner can write a "Note to reviewers" that shows as a modal when a reviewer first opens the share link.

**Schema:**
```sql
alter table review_projects
  add column reviewer_note text,
  add column reviewer_note_show boolean not null default false;
```

**UI:**
- New left-sidebar link on admin project pages (`/feedback/[id]/board`, etc.): "Add a note for the reviewers" → opens editor modal (screenshot 7).
- Public reviewer side (`/review/[token]`, `/whiteboard/[token]`): if `reviewer_note_show` is true and not yet acknowledged (localStorage key `av-note-ack-${token}`), show the note as an overlay on first load with a dismiss button.

**Verify:** set a note with "show to reviewers" checked → open the share link in an incognito window → note appears → dismiss persists.

---

## PR 7 — Complete-your-feedback flow `[window]`

**Goal:** Screenshot 8 — reviewer clicks "Let the team know you finished reviewing" in the left sidebar (screenshot 7, bottom), modal opens with optional message and `Finish` button. Submitting marks the review session as completed and (optionally) notifies the team via the existing `/api/review-notify` webhook pipeline.

**Schema:**
```sql
create table review_completions (
  id uuid primary key default gen_random_uuid(),
  review_project_id uuid not null references review_projects(id) on delete cascade,
  reviewer_name text,
  reviewer_email text,
  message text,
  completed_at timestamptz not null default now()
);
```

**UI:**
- "Let the team know you finished reviewing" button in the reviewer left sidebar → opens modal (screenshot 8) → submit posts to new `/api/review/[token]/complete` endpoint → shows a confirmation toast and disables the button for the session.

**Verify:** click Finish with a message → row appears in `review_completions` → webhook fires → admin sees completion event.

---

## PR 8 — Top app bar + left sidebar chrome `[window]`

**Goal:** Screenshots 7-8 — the overall page chrome. Project name, status pill, device toggles (desktop/tablet/mobile), Comment / Browse toggle, user avatar, Share button in the top bar. Left sidebar with comment thread list, "Pause new comments" toggle, note/finish links.

**Changes:**
- New [components/feedback/ReviewChrome.tsx](components/feedback/ReviewChrome.tsx) — top bar component; wraps `/review/[token]` and `/whiteboard/[token]` pages.
- Left sidebar → refactor existing `components/feedback/ItemSidebar.tsx` to match the layout; include pause toggle, note-for-reviewers link (PR 6), finish-reviewing link (PR 7).
- Device toggles swap between 1440 / 768 / 375 wide preview frames for webpage items. Non-webpage items hide the toggles.
- Comment / Browse toggle: `Comment` = current behaviour (pins active), `Browse` = disables pin placement so reviewer can interact with the live page/links.

**Verify:** open a shared review link → chrome matches screenshot 7 structure → device toggle resizes viewport frame → Browse mode lets you click through links without dropping pins.

---

## PR 9 — Video recording `[both]`

**Goal:** Wire up the currently-disabled video button. Use MediaRecorder API to record screen + mic, upload to storage, attach as `video` comment type.

**Schema:** no change — reuse `screenshot_url` column renamed in DB comment to `media_url` via migration, or add a new `video_url` column.

**UI:**
- Video icon in composer → starts recording (shows countdown + red dot), click again to stop, preview + post.

**Heavy — likely last priority.** Markup.io's implementation uses Loom-style flows; we'd need a lightweight MVP (max 2 min, mic optional, desktop-only).

---

## PR 10 — Emoji picker enhancement (low priority) `[both]`

**Goal:** Richer emoji picker with search + categories (screenshot 4). The existing `EmojiPicker.tsx` is a shortcut list.

**Changes:**
- Add `emoji-mart` (already-popular, small, no lock-in): `npm install @emoji-mart/data @emoji-mart/react`.
- Swap `EmojiPicker.tsx` implementation; keep the same prop surface so call-sites don't change.

---

## Dependencies graph

```
PR 1 (composer visual) ──┬─► PR 2 (highlight badges)
                         ├─► PR 3 (priority) ──► PR 4 (pill composer)
                         └─► PR 5 (attach modal) ┘
                                 │
PR 6 (note) ─────────────────────┤
PR 7 (complete) ─────────────────┤
                                 ▼
                         PR 8 (top bar + sidebar)
                                 │
                                 ▼
                    PR 9 (video), PR 10 (emoji)
```

PR 1 is unblocking. PRs 3, 5, 6, 7 can ship in parallel. PR 4 and PR 8 need the earlier ones. PRs 9-10 are tail.

---

## Estimated effort (rough)

| PR | Effort | Risk |
|----|--------|------|
| 1. Composer visual | ~2-3 h | Low |
| 2. Highlight badges | ~1-2 h | Low |
| 3. Priority | ~4-5 h | Med (schema + migration) |
| 4. Pill composer | ~4-6 h | Med (new draw modes) |
| 5. Attach modal | ~2-3 h | Low |
| 6. Note to reviewers | ~3-4 h | Low (schema) |
| 7. Complete flow | ~3-4 h | Low (schema + webhook) |
| 8. Chrome | ~6-8 h | High (touches many pages) |
| 9. Video | ~8-12 h | High (MediaRecorder edge cases, storage) |
| 10. Emoji | ~1-2 h | Low |

Total: ~35-50 h. Would suggest landing PRs 1-3 together as a first batch (it's the highest-leverage visual/functional lift), then 4-5, then 6-8, then 9-10 as tail.

---

## Verification (cross-cutting)

After each PR:
- `npm run build` passes clean (TypeScript + Next.js).
- Manual walkthrough on `npm run dev`:
  - Admin path: `/feedback/:id/items/:itemId` → drop pin / highlight text → compose / post.
  - Public path: `/review/[token]` in an incognito tab → same flow as a guest.
  - Embedded widget: install on a real page via `/feedback/:id/setup` → same flow.
- Smoke-test the Feedback tab + Kanban + Board pages after any schema change to confirm new columns aren't breaking reads.

---

## Decision log
- **2026-04-22** — user confirmed plain textarea composer (no TipTap, no formatting toolbar, no mentions).
- **2026-04-22** — user confirmed priority in scope.
- **2026-04-22** — user confirmed markup.io highlight UX pattern.
- **2026-04-22** — user asked to plan the full rework as a separate project rather than chip away at it; current session stops after PR 1's prerequisites land.
