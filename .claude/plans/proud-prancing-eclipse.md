# Creative Review & Feedback Tool — Completion Plan

## Context

The Creative Review tool is a Markup.io/Miro hybrid where agencies share campaign assets with clients for visual feedback. The core infrastructure exists: pin comments, a comment sidebar, an embeddable widget (with pin/box/text/screenshot tools), a React Flow whiteboard, and content renderers for ads/email/SMS/images/webpages. However, the in-app review viewer is limited to pin-only feedback, several content types are missing renderers, and social features (reactions, attachments) aren't implemented.

This plan tidies up the existing code and builds out the remaining features to reach feature parity with the vision.

### Key Decisions
- **Pin always active everywhere** — clicking on any content type (including email/SMS mockups) places a pin. Text highlight is a separate additional feature (Phase 5).
- **Google Ads** — Support Search Ads (text) and Display Ads (image/banner). No YouTube ad format.
- **Drawing annotations attached to comments** — Each arrow/box/text annotation is tied to a comment thread. Appears when hovering/clicking that comment. Matches widget behavior.
- **Starting with Phase 1** — Always-active pin + scroll-to-comment, since everything else builds on it.

---

## Phase 1: Always-Active Pin + Pin-to-Comment Navigation ✅ COMPLETE

**Goal:** Remove the pin toggle friction — clicking content always places a pin. Clicking an existing pin scrolls the sidebar to that comment.

### Files to modify:
- [hooks/usePinFeedback.ts](hooks/usePinFeedback.ts) — Remove `feedbackMode !== 'pin'` gate on `handleImageClick` (line 19). Pin is always active by default. Keep `FeedbackMode` type for drawing tools later, but pin no longer requires mode selection.
- [components/reviews/feedback/FeedbackToolbar.tsx](components/reviews/feedback/FeedbackToolbar.tsx) — Remove the pin toggle button. Keep comments toggle + badge. Expand `FeedbackMode` to include `'arrow' | 'box' | 'text' | 'screenshot'` (buttons added in Phase 3). Pin is the implicit default when no drawing tool is active.
- [components/reviews/feedback/FeedbackModeBar.tsx](components/reviews/feedback/FeedbackModeBar.tsx) — Remove pin mode message. Only show bar for drawing tool modes.
- [components/reviews/ReviewDetailView.tsx](components/reviews/ReviewDetailView.tsx) — Always pass `placingPin={true}` to `ItemContentView` when no drawing tool is active. Wire `handlePinClick(commentId)` to set `highlightedCommentId` state, open comments panel, and pass it to `CommentsPanel`.
- [components/reviews/ItemContentView.tsx](components/reviews/ItemContentView.tsx) — Always show crosshair cursor on pinnable content. Enable pin placement on email/SMS mockup containers too.
- [components/reviews/PinOverlay.tsx](components/reviews/PinOverlay.tsx) — Change `onPinClick` to pass `commentId: string` so the parent can scroll to it.
- [components/reviews/comments/CommentsPanel.tsx](components/reviews/comments/CommentsPanel.tsx) — Add `highlightCommentId` prop. Auto-scroll to matching thread via `scrollIntoView`.
- [components/reviews/comments/CommentThread.tsx](components/reviews/comments/CommentThread.tsx) — Add `data-comment-id` attribute and temporary highlight ring when targeted.

---

## Phase 2: New Item Types + Missing Renderers ✅ COMPLETE

**Goal:** Add Google Ad, PDF, and Video renderers. Add admin creation forms. Update whiteboard nodes.

### 2a. Types & Schema

- **Supabase migration** — Add `google_ad` and `pdf` as valid item types. Add columns: `video_url`, `pdf_url`, `google_ad_headline`, `google_ad_description1`, `google_ad_description2`, `google_ad_display_url`, `google_ad_final_url` to `review_items`.
- [lib/types/review.ts](lib/types/review.ts) — Add `'google_ad' | 'pdf'` to `ReviewItemType`. Add corresponding fields to `ReviewItem`.

### 2b. Content Renderers

- [components/reviews/ItemContentView.tsx](components/reviews/ItemContentView.tsx) — Add render branches for:
  - **Video** — `<video>` element with controls for direct URLs, iframe for YouTube/Vimeo. Wrap in pin overlay container.
  - **PDF** — Reuse existing `react-pdf` (already a dependency). Render scrollable pages with pin overlay.
  - **Google Ad** — New `GoogleAdMockupPreview` component.
- **New:** `components/admin/reviews/GoogleAdMockupPreview.tsx` — Two format variants:
  - **Search Ad** — Google Search result mockup (headline, descriptions, display URL, sitelinks).
  - **Display Ad** — Image/banner creative with dimensions label. Uses `ad_creative_url` for the banner image.

### 2c. Admin Creation Forms

- **New:** `components/admin/reviews/review-item-forms/VideoItemForm.tsx` — URL input (direct video or YouTube/Vimeo), thumbnail upload.
- **New:** `components/admin/reviews/review-item-forms/PdfItemForm.tsx` — PDF file upload to Supabase storage.
- **New:** `components/admin/reviews/review-item-forms/GoogleAdItemForm.tsx` — Format toggle (Search/Display), headline, description lines, display URL, final URL fields. Display format adds image upload.
- Update the item creation modal/dialog to include the new types in the type selector.

### 2d. Whiteboard Nodes

- **New:** `components/admin/reviews/board/nodes/GoogleAdNode.tsx` — Icon-style node.
- **New:** `components/admin/reviews/board/nodes/PdfNode.tsx` — Card-style node with PDF icon.
- Update `ReviewItemNode.tsx` dispatcher + `NODE_LAYOUTS` config to register new types.

---

## Phase 3: Drawing Tools (Arrows, Boxes, Text) in In-App Viewer ✅ COMPLETE

**Goal:** Bring the widget's annotation tools into the React in-app viewer.

### Files to modify/create:
- [components/reviews/feedback/FeedbackToolbar.tsx](components/reviews/feedback/FeedbackToolbar.tsx) — Add toolbar buttons for arrow, box, text tools (lucide: `MoveUpRight`, `Square`, `Type`). Each toggles its mode.
- [components/reviews/feedback/FeedbackModeBar.tsx](components/reviews/feedback/FeedbackModeBar.tsx) — Add mode messages for arrow/box/text.
- **New:** `components/reviews/feedback/DrawingOverlay.tsx` — Canvas-based overlay for drawing arrows, boxes, and text annotations over content. Port logic from widget's `box-mode.ts` and `text-mode.ts`. On complete, produces `annotation_data` JSON stored with the comment.
- **New:** `hooks/useDrawingFeedback.ts` — Manages drawing state, current tool, pending annotation. Composes with `usePinFeedback` (or merge into a unified `useFeedback` hook).
- [components/reviews/ReviewDetailView.tsx](components/reviews/ReviewDetailView.tsx) — Render `DrawingOverlay` when a drawing tool is active. On annotation complete, show comment form with annotation data.
- [components/reviews/PinOverlay.tsx](components/reviews/PinOverlay.tsx) — Extend to also render saved box/text/arrow annotations from `annotation_data` on existing comments.

---

## Phase 4: Screenshot Capture, File Attachments, Emoji Reactions

### 4a. Auto-Screenshot on Pin Placement ✅ COMPLETE

- ✅ `hooks/useScreenshotCapture.ts` — html2canvas capture + upload to screenshot endpoint.
- ✅ `ReviewDetailView` — `captureScreenshot` called in `handleImageClick`, `pendingScreenshotUrl` passed through submit chain.
- ✅ Admin page `submitComment` — accepts and stores `screenshot_url`.
- ✅ Client page `submitComment` — passes `screenshot_url` to API.
- ✅ API route — destructures and inserts `screenshot_url`.
- ✅ `ReviewComment` type has `screenshot_url: string | null`.

### 4b. File Attachments on Comments ✅ COMPLETE

- ✅ Types added: `ReviewCommentAttachment` type, `attachments` field on `ReviewComment`.
- ✅ **New:** `app/api/review-comments/attachments/route.ts` — POST endpoint for file upload.
- ✅ **New:** `components/reviews/comments/AttachmentPicker.tsx` — Paperclip button + file input + preview thumbnails.
- ✅ `PendingPinForm`, `GeneralCommentForm` — AttachmentPicker integrated.
- ✅ `CommentThread` — Renders attachment thumbnails/links below comment content.

### 4c. Emoji Reactions ✅ COMPLETE

- ✅ Types added: `ReviewCommentReaction` type.
- ✅ **New:** `app/api/review-comments/[id]/reactions/route.ts` — Toggle pattern (POST adds or removes).
- ✅ **New:** `components/reviews/comments/ReactionBar.tsx` — Curated 6-emoji picker with count chips.
- ✅ `CommentThread` — ReactionBar integrated below each comment and reply.

---

## Phase 5: Text Highlight for HTML Content ✅ COMPLETE

**Goal:** Users can select text in email/SMS HTML content and leave comments on the selection.

- ✅ `hooks/useTextHighlight.ts` — `window.getSelection()` capture with flat character offsets + element path. Floating "Add Comment" button positioning.
- ✅ `components/reviews/feedback/HighlightOverlay.tsx` — DOM-based `<mark>` wrapping of saved highlight ranges, click-to-navigate, pulse animation on highlight.
- ✅ `ItemContentView.tsx` — `HighlightOverlay` rendered in email and SMS containers.
- ✅ `ReviewDetailView.tsx` — `useTextHighlight` hook, floating button, `pendingHighlight` state, highlight data passed through submit chain.
- ✅ Admin + client pages — `highlightData` accepted and stored (`highlight_start/end/text/element_path`, `comment_type: 'text_highlight'`).
- ✅ API route — accepts and inserts all highlight fields.

---

## Implementation Order & Dependencies

```
Phase 1 (always-active pin + scroll-to-comment)
  ├──> Phase 2 (new types + renderers) — independent
  ├──> Phase 3 (drawing tools) — needs expanded FeedbackMode from Phase 1
  └──> Phase 4a (auto-screenshot) — needs pin flow from Phase 1
       Phase 4b (attachments) — independent, can parallel with anything
       Phase 4c (reactions) — independent, can parallel with anything
Phase 5 (text highlight) — needs email/SMS renderers from Phase 2
```

**Recommended order:** 1 → 2 → 4b + 4c (parallel) → 3 → 4a → 5

### Progress
- ✅ Phase 1 — Always-active pin + scroll-to-comment
- ✅ Phase 2 — New item types (Google Ad, PDF, Video) + renderers + admin forms + whiteboard nodes
- ✅ Phase 3 — Drawing tools (arrows, boxes, text) with SVG overlay
- ✅ Phase 4b — File attachments on comments
- ✅ Phase 4c — Emoji reactions
- ✅ Phase 4a — Auto-screenshot on pin placement
- ✅ Phase 5 — Text highlight for HTML content

### ALL PHASES COMPLETE

---

## Verification

- **Phase 1:** Open a review item, click on image/ad content → pin appears immediately without toggling a tool. Click existing pin → sidebar scrolls to that comment with highlight animation.
- **Phase 2:** Create Google Ad, PDF, Video items via admin. Verify they render correctly in the detail view and appear as nodes on the whiteboard.
- **Phase 3:** Select arrow/box/text tool → draw on content → annotation persists and comment form appears. Reload → annotations render from saved data.
- **Phase 4a:** Place a pin → screenshot is automatically captured and stored on the comment. Visible in comment thread.
- **Phase 4b:** Attach a file to a comment → file uploads, thumbnail/link appears in the thread.
- **Phase 4c:** Click reaction emoji on a comment → reaction appears with count. Toggle off by clicking again.
- **Phase 5:** Select text in an email mockup → floating "Add Comment" button appears → click → comment form opens with highlighted text context. Reload → highlight marks appear on previously commented text.
