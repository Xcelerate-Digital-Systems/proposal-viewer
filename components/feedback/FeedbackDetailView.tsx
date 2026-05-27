'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Monitor, Pause } from 'lucide-react';
import CompleteFeedbackModal from './CompleteFeedbackModal';
import FeedbackHeaderBar from './FeedbackHeaderBar';
import type { FeedbackProject, FeedbackItem, FeedbackComment, FeedbackStatus } from '@/lib/supabase';
import {
  type FeedbackCommentPriority,
  type FeedbackItemView,
  defaultViewForItem,
  getCommentView,
  parseGoogleAdAssetView,
} from '@/lib/types/feedback';
import { applyVersion, type VersionView } from '@/lib/feedback/versions';
import type { CompanyBranding } from '@/hooks/useProposal';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import { useScreenshotCapture } from '@/hooks/useScreenshotCapture';
import { useCommentFilters } from '@/hooks/useCommentFilters';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { CommentsPanel } from '@/components/feedback/comments';
import ItemContentView from '@/components/feedback/ItemContentView';
import PinCommentPopover from '@/components/feedback/PinCommentPopover';
import PendingPinPopover from '@/components/feedback/PendingPinPopover';
import WebpageClientPlaceholder from '@/components/feedback/WebpageClientPlaceholder';
import { FeedbackToolbar, FeedbackModeBar, DrawingOverlay } from '@/components/feedback/tools';
import type { AnnotationData } from '@/components/feedback/tools';
import { useTextHighlight, type TextHighlightData } from '@/hooks/useTextHighlight';
import { useTeamMemberLookup } from '@/hooks/useTeamMemberLookup';

/* ─── Types ──────────────────────────────────────────────────────── */

interface ReviewDetailViewProps {
  /** 'admin' = authenticated team member, 'client' = public token-based */
  mode: 'admin' | 'client';

  // ── Data ──
  project: FeedbackProject;
  items: FeedbackItem[];
  comments: FeedbackComment[];
  /** All project comments for sidebar badge counts (admin only — lightweight shape) */
  allProjectComments?: Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[];

  // ── Branding (client mode) ──
  branding?: CompanyBranding;

  // ── Initial selection ──
  /** Pre-select this item on mount */
  initialItemId?: string | null;
  /** Pre-set type filter (e.g. ?type=ad) */
  initialTypeFilter?: string | null;
  /** Show only a single item — no sidebar (individual item share) */
  singleItemOnly?: boolean;
  /** Hide the type filter bar in sidebar (e.g. when deep-linked from whiteboard) */
  hideFilterBar?: boolean;

  // ── Identity ──
  /** Admin: fixed author name for comments */
  authorName?: string;
  /** Client: guest name state */
  guestName?: string;
  /** Client: guest name setter */
  onGuestNameChange?: (name: string) => void;

  // ── Callbacks ──
  /** Submit a new comment */
  onSubmitComment: (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => Promise<void>;
  /** Resolve a comment (admin only) */
  onResolveComment?: (commentId: string) => Promise<void>;
  /** Unresolve a comment (admin only) */
  onUnresolveComment?: (commentId: string) => Promise<void>;
  /** Edit a comment's content (admin only) */
  onEditComment?: (commentId: string, content: string) => Promise<void>;
  /** Delete a comment and its replies (admin only) */
  onDeleteComment?: (commentId: string) => Promise<void>;
  /** Called when selected item changes — admin uses this for router.push */
  onItemChange?: (itemId: string, typeFilter: string | null) => void;
  /** Called when type filter changes — admin uses this for URL sync */
  onFilterChange?: (type: string | null, firstItemId: string | null) => void;

  // ── Navigation ──
  /** Back button config — { label, onClick } */
  backAction?: { label: string; onClick: () => void };
  /** Share token for content loading (e.g. signed URLs) */
  shareToken?: string;

  /**
   * When true, click-to-pin + automatic text-highlight capture are disabled so
   * the reviewer can interact with the underlying content (click links, scroll
   * inside frames, select text without leaving a comment). Drawing tools still
   * work if the user explicitly picks one.
   */
  browseMode?: boolean;

  // ── Admin extras ──
  /** Render function for header-right actions (share button, external link, etc.) */
  renderHeaderActions?: (currentItem: FeedbackItem | null) => React.ReactNode;

  // ── Attachments ──
  /** Company ID — needed for attachment uploads */
  companyId?: string;

  // ── Comments updated externally (e.g. after submit in parent) ──
  /** Updated comments array — when parent manages comment state */
  onCommentsUpdate?: (comments: FeedbackComment[]) => void;

  // ── Versions (per selected item) ──
  /** Ordered list of versions for the currently-selected item, v1 first. */
  versions?: VersionView[];
  /** review_item_versions.id of the active version, or null for v1. */
  activeVersionId?: string | null;
  /** Called when the user picks a different version. */
  onVersionChange?: (versionId: string | null) => void;
  /** When provided, the version picker shows a "+" button that calls this. */
  onAddVersion?: () => void;
  /** Open the editor for an existing version (admin only). */
  onEditVersion?: (versionId: string | null) => void;

  // ── Client status update ──
  /** Client can change status (approve / request revision / reject). When
   *  provided, a status picker appears in the header. */
  onUpdateItemStatus?: (itemId: string, status: FeedbackStatus) => Promise<void> | void;

  // ── Public review chrome (client mode only) ──
  /** When provided, renders Comment/Browse pill, reviewer avatar, and Finish
   *  reviewing button on the right of the header. */
  reviewMode?: 'comment' | 'browse';
  onReviewModeChange?: (mode: 'comment' | 'browse') => void;
  reviewerName?: string;
  reviewerEmail?: string;
  reviewSubmitted?: boolean;
  onReviewSubmitted?: () => void;
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function FeedbackDetailView({
  mode,
  project,
  items,
  comments,
  allProjectComments,
  branding,
  initialItemId,
  initialTypeFilter,
  singleItemOnly = false,
  hideFilterBar = false,
  authorName,
  guestName,
  onGuestNameChange,
  onSubmitComment,
  onResolveComment,
  onUnresolveComment,
  onEditComment,
  onDeleteComment,
  onItemChange,
  onFilterChange,
  backAction,
  shareToken,
  browseMode = false,
  renderHeaderActions,
  companyId,
  versions,
  activeVersionId = null,
  onVersionChange,
  onAddVersion,
  onEditVersion,
  onUpdateItemStatus,
  reviewMode,
  onReviewModeChange,
  reviewerName,
  reviewerEmail,
  reviewSubmitted = false,
  onReviewSubmitted,
}: ReviewDetailViewProps) {
  const isAdmin = mode === 'admin';
  const isClient = mode === 'client';

  // Mention-autocomplete data source. Admin reaches the authenticated route;
  // client reaches the share-token route. Excluding the viewer's own email
  // keeps "@yourself" out of the dropdown.
  const participantsUrl =
    isAdmin && project?.id
      ? `/api/campaigns/${project.id}/participants`
      : isClient && shareToken
      ? `/api/review/${shareToken}/participants${reviewerEmail ? `?exclude_email=${encodeURIComponent(reviewerEmail)}` : ''}`
      : null;

  // ── Selection state ──
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialItemId || items[0]?.id || null
  );
  const [typeFilter, setTypeFilter] = useState<string | null>(initialTypeFilter || null);
  const [showComments, setShowComments] = useState(true);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // ── Branding colors (client mode) ──
  const brandingColors = useBrandingColors(branding ?? {} as CompanyBranding);
  const { accent, border, sidebarText, bgSecondary } = brandingColors;

  // hasBranding gates the logo/name divider in the header.
  const hasBranding = !!branding?.logo_url || !!branding?.name;
  // headerBranded drives the dark sidebar background on the header strip.
  // Always branded on the public review side (matches the whiteboard
  // pattern even when the company hasn't uploaded a logo). Branded on the
  // admin side too whenever branding has been resolved (e.g. bg_secondary
  // is set), so admin and client share the same chrome.
  const headerBranded = isClient || !!branding?.bg_secondary;

  // ── Feedback hooks ──
  const {
    feedbackMode, pinActive, pendingPin, setPendingPin, imageContainerRef,
    handleImageClick: baseHandleImageClick, handleCancelPin,
    changeFeedbackMode, resetFeedback,
  } = usePinFeedback();

  // ── Screenshot capture ──
  const { capture: captureScreenshot } = useScreenshotCapture({
    shareToken,
    itemId: selectedItemId,
  });

  // Team-member avatar lookup. CommentsPanel already calls this hook for its
  // own list; the request is cached per-token in the hook module, so this
  // duplicate call here (needed to populate PinCommentPopover's avatars from
  // anywhere on the page) is essentially free.
  const memberLookup = useTeamMemberLookup(shareToken);
  const [pendingScreenshotUrl, setPendingScreenshotUrl] = useState<string | null>(null);

  // ── Drawing annotation state ──
  const [pendingAnnotation, setPendingAnnotation] = useState<AnnotationData | null>(null);

  // Handle annotation completion from DrawingOverlay
  const handleAnnotationComplete = useCallback(
    (pinX: number, pinY: number, annotation: AnnotationData) => {
      setPendingPin({ x: pinX, y: pinY });
      setPendingAnnotation(annotation);
      setShowComments(true);
      changeFeedbackMode('idle');
    },
    [setPendingPin, changeFeedbackMode]
  );

  const [pendingHighlight, setPendingHighlight] = useState<TextHighlightData | null>(null);

  // ── Pin popover state ──
  const [popoverCommentId, setPopoverCommentId] = useState<string | null>(null);

  // ── Pin-to-comment scroll state ──
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // ── Active mockup sub-view (lead-form page, email client, ad platform, etc.)
  // Lifted out of ItemContentView so we can: (a) scope new pins / drawings
  // / highlights to the current view, and (b) jump to a pin's stored view
  // when the reviewer clicks it from the comments list. Null = use the
  // item's natural default. Reset on item change. ──
  const [activeView, setActiveView] = useState<FeedbackItemView>(null);

  // ── Derived data ──
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const rawSelectedItem = useMemo(() => {
    return filteredItems.find((i) => i.id === selectedItemId)
      || items.find((i) => i.id === selectedItemId)
      || null;
  }, [filteredItems, items, selectedItemId]);

  // Merge the active version's asset fields onto the item so every downstream
  // renderer (ItemContentView, thumb strip, etc.) sees the right URLs / copy
  // without knowing about versions. Falls through to raw item when the item
  // has no versions, keeping pre-versioning items unchanged.
  const activeVersion = useMemo<VersionView | null>(() => {
    if (!versions || versions.length === 0) return null;
    return versions.find((v) => (v.id ?? null) === (activeVersionId ?? null)) || versions[0];
  }, [versions, activeVersionId]);

  const selectedItem = useMemo<FeedbackItem | null>(() => {
    if (!rawSelectedItem) return null;
    if (!activeVersion) return rawSelectedItem;
    return applyVersion(rawSelectedItem, activeVersion);
  }, [rawSelectedItem, activeVersion]);

  // Resolve the active sub-view: explicit override, else item's natural default.
  // Null for items without sub-views (image, video, pdf, webpage).
  const currentMockupView = useMemo<FeedbackItemView>(
    () => (activeView !== null ? activeView : (selectedItem ? defaultViewForItem(selectedItem) : null)),
    [activeView, selectedItem],
  );

  // Filter annotation comments (drawings — arrow / box / text). Excludes
  // pin-only comments that just store `{ view }` (no `type`). Scoped to the
  // active version + the current sub-view so drawings on the lead form's
  // intro page don't bleed onto the questions page.
  const annotationComments = useMemo(() => {
    return comments.filter((c) => {
      if (c.review_item_id !== selectedItemId) return false;
      if (versions && versions.length > 1 && (c.version_id ?? null) !== (activeVersionId ?? null)) return false;
      const ann = (c as unknown as { annotation_data: Record<string, unknown> | null }).annotation_data;
      if (!ann || typeof ann.type !== 'string') return false;
      if (currentMockupView == null) return true;
      return getCommentView(ann) === currentMockupView;
    });
  }, [comments, selectedItemId, versions, activeVersionId, currentMockupView]);

  // ── Text highlight state (available for all content types) ──
  const { selection: textSelection, clearSelection: clearTextSelection, resetSelection: resetTextSelection } = useTextHighlight({
    containerRef: imageContainerRef as React.RefObject<HTMLElement | null>,
    enabled: !browseMode && !(!isAdmin && !!project?.pause_new_comments) && (feedbackMode === 'idle' || feedbackMode === 'highlight'),
  });

  // Filter text_highlight comments (scoped to active version)
  const highlightComments = useMemo(
    () => comments.filter((c) =>
      c.review_item_id === selectedItemId && c.comment_type === 'text_highlight' &&
      (!versions || versions.length <= 1 || (c.version_id ?? null) === (activeVersionId ?? null))
    ),
    [comments, selectedItemId, versions, activeVersionId]
  );

  // Unresolved comment counts per asset view, for the Google Search ad
  // sidebar badges. Keyed by view string ("headline-3" → 2). Root threads only.
  const commentCountsByView = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const c of comments) {
      if (c.review_item_id !== selectedItemId) continue;
      if (c.parent_comment_id) continue;
      if (c.resolved) continue;
      if (versions && versions.length > 1 && (c.version_id ?? null) !== (activeVersionId ?? null)) continue;
      const view = getCommentView(c.annotation_data);
      if (!view) continue;
      counts[view] = (counts[view] || 0) + 1;
    }
    return counts;
  }, [comments, selectedItemId, versions, activeVersionId]);

  // Auto-open comment form when text is selected — no extra button needed.
  // Note: we deliberately don't wipe the browser's Selection here; we want
  // the highlighted text to stay visible while the reviewer composes the
  // comment. resetTextSelection clears only the hook's internal state so
  // the next drag can re-trigger capture. A teal <mark> overlay (rendered
  // below) keeps the range visually marked even after the textarea steals
  // focus and collapses the native selection.
  useEffect(() => {
    if (textSelection) {
      setPendingHighlight(textSelection);
      setShowComments(true);
      resetTextSelection();
    }
  }, [textSelection, resetTextSelection]);

  const handleSubmitComment = useCallback(
    async (content: string, pinX?: number, pinY?: number, parentId?: string, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => {
      if (!selectedItemId) return;
      const highlight = pendingHighlight
        ? { text: pendingHighlight.text, start: pendingHighlight.startOffset, end: pendingHighlight.endOffset, elementPath: pendingHighlight.elementPath }
        : undefined;

      // Stamp pins / annotations / highlights with the view they were placed on
      // (lead form pages, email clients, ad platforms, etc.). For Google Search
      // ads we also stamp plain general comments, so the sidebar selection acts
      // as a per-asset feedback target.
      //
      // Special case: a pin dropped inside a `[data-creative]` element (Meta ad
      // image) is *shared* across every variant/platform, since the creative
      // doesn't change between variants. Those pins get view='creative' instead
      // of the active variant view, and the visible-pins filter in
      // ItemContentView lets them through on every view.
      const isGoogleSearchAd = selectedItem?.type === 'google_search_ad';
      const isAnnotation = pinX != null || !!pendingAnnotation || !!highlight;
      const isCreativePin = pendingPin?.target === 'creative' && pinX != null;
      const shouldStampView = (isAnnotation || isGoogleSearchAd) && (isCreativePin || currentMockupView != null);
      const stampedView = isCreativePin ? 'creative' : currentMockupView;
      const annotationPayload = shouldStampView
        ? { ...(pendingAnnotation || {}), view: stampedView }
        : (pendingAnnotation || undefined);

      await onSubmitComment(selectedItemId, content, pinX, pinY, parentId, annotationPayload, pendingScreenshotUrl || undefined, highlight, priority, attachments, videoUrl);
      setPendingAnnotation(null);
      setPendingScreenshotUrl(null);
      setPendingHighlight(null);
    },
    [selectedItemId, selectedItem, currentMockupView, onSubmitComment, pendingAnnotation, pendingScreenshotUrl, pendingHighlight, pendingPin]
  );

  const currentIdx = filteredItems.findIndex((i) => i.id === selectedItemId);
  const isWebpageItem = selectedItem?.type === 'webpage';

  // Comments are pinned to the version they were made on — filter the feed to
  // whichever version is currently showing so pins / highlights line up with
  // the rendered asset. v1 comments have version_id === null.
  const versionScopedComments = useMemo(() => {
    if (!versions || versions.length <= 1) return comments;
    const activeId = activeVersion?.id ?? null;
    return comments.filter((c) => (c.version_id ?? null) === activeId);
  }, [comments, versions, activeVersion]);

  // ── Comment filtering ──
  const {
    topLevelComments, getReplies,
    unresolvedComments, resolvedComments, pinComments,
  } = useCommentFilters(versionScopedComments, selectedItemId);

  // ── Keep selection in sync when filter changes and current item is hidden ──
  useEffect(() => {
    if (singleItemOnly) return;
    if (filteredItems.length > 0 && !filteredItems.find((i) => i.id === selectedItemId)) {
      const fallback = filteredItems[0].id;
      setSelectedItemId(fallback);
    }
  }, [filteredItems, selectedItemId, singleItemOnly]);

  // ── Sync initial item when it changes (e.g. admin router navigation) ──
  useEffect(() => {
    if (initialItemId && initialItemId !== selectedItemId) {
      setSelectedItemId(initialItemId);
    }
  }, [initialItemId]);

  // ── Sync initial type filter ──
  useEffect(() => {
    if (initialTypeFilter !== undefined) {
      setTypeFilter(initialTypeFilter || null);
    }
  }, [initialTypeFilter]);

  // Reviewers can't drop new pins when the admin has paused comments for
  // this project. isAdmin keeps pause off on the admin detail viewer.
  const commentsLocked = !isAdmin && !!project?.pause_new_comments;

  // ── Pin click → always open comments when pin is placed ──
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Browse mode: reviewer wants to interact with the underlying content, not
    // drop a pin. Bail before anything fires.
    if (browseMode) return;
    if (commentsLocked) return;

    // Compute click position as % within the container BEFORE forwarding the
    // event — so we can hand the same coords to the screenshot crop and end
    // up with a 16:9 frame centred on the pin marker.
    const rect = e.currentTarget.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;

    baseHandleImageClick(e);
    if (pinActive) {
      setShowComments(true);
      // Wait two animation frames so React has flushed the pending pin into
      // the DOM before html2canvas snapshots it — otherwise the screenshot
      // captures the image without the pin marker.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          captureScreenshot(imageContainerRef.current, { cropAroundPct: { x: pctX, y: pctY } }).then((url) => {
            if (url) setPendingScreenshotUrl(url);
          });
        });
      });
    }
  }, [browseMode, commentsLocked, baseHandleImageClick, pinActive, captureScreenshot, imageContainerRef]);

  // ── Existing pin clicked → switch to its view (if scoped), then show popover ──
  const handlePinClick = useCallback((commentId?: string) => {
    if (!commentId) return;
    const c = comments.find((x) => x.id === commentId);
    const pinView = c ? getCommentView(c.annotation_data) : null;
    if (pinView) setActiveView(pinView);
    setPopoverCommentId((prev) => prev === commentId ? null : commentId);
  }, [comments]);

  // ── Reply via popover ──
  const handlePopoverReply = useCallback(async (content: string, parentId: string) => {
    if (!selectedItemId) return;
    await onSubmitComment(selectedItemId, content, undefined, undefined, parentId);
  }, [selectedItemId, onSubmitComment]);

  // Find the comment for the popover
  const popoverComment = useMemo(
    () => popoverCommentId ? comments.find((c) => c.id === popoverCommentId) || null : null,
    [popoverCommentId, comments]
  );

  // Close popover and reset active sub-view when item changes
  useEffect(() => {
    setPopoverCommentId(null);
    setActiveView(null);
  }, [selectedItemId]);

  // ── Navigate items ──
  const goToItem = useCallback((idx: number) => {
    if (idx >= 0 && idx < filteredItems.length) {
      const nextId = filteredItems[idx].id;
      setSelectedItemId(nextId);
      resetFeedback();
      onItemChange?.(nextId, typeFilter);
    }
  }, [filteredItems, typeFilter, resetFeedback, onItemChange]);

  // ── Select item from sidebar ──
  const handleSidebarSelect = useCallback((id: string) => {
    setSelectedItemId(id);
    resetFeedback();
    onItemChange?.(id, typeFilter);
  }, [typeFilter, resetFeedback, onItemChange]);

  // ── Filter change ──
  const handleFilterChange = useCallback((type: string | null) => {
    setTypeFilter(type);
    const newFiltered = type ? items.filter((i) => i.type === type) : items;
    const currentStillVisible = newFiltered.some((i) => i.id === selectedItemId);
    const targetId = currentStillVisible ? selectedItemId : newFiltered[0]?.id || null;

    if (targetId && targetId !== selectedItemId) {
      setSelectedItemId(targetId);
    }

    onFilterChange?.(type, targetId);
    onItemChange?.(targetId!, type);
  }, [items, selectedItemId, onFilterChange, onItemChange]);

  // ── Mobile gate ──
  const MobileGate = (
    <div className="flex lg:hidden min-h-screen items-center justify-center bg-surface p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border-2 border-gray-300">
          <Monitor size={24} className="text-dim" />
        </div>
        <h2 className="text-base font-semibold text-ink">Desktop Required</h2>
        <p className="text-sm text-dim mt-2 leading-relaxed">
          Please open this feedback on a desktop browser for the best experience.
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  //  HEADER + DETAIL MODE — thumb strip in header, comments on left.
  //  Used for every entry point (admin, public project share, public item
  //  share, deep-link from whiteboard). singleItemOnly hides item cycling
  //  but keeps the same chrome.
  // ══════════════════════════════════════════════════════════════════

  // Determine which types to show in filter — hide when hideFilterBar is set
  const stripTypes = hideFilterBar ? [] : (isAdmin && typeFilter ? [] : availableTypes);

  const stripVariant: 'admin' | 'branded' = isAdmin || !hasBranding ? 'admin' : 'branded';
  const stripComments = isAdmin
    ? allProjectComments
    : (comments as Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[]);

  return (
    <>
      {isClient && branding && (
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />
      )}

      {MobileGate}

      <div className={`hidden lg:flex ${isAdmin ? 'h-full' : 'h-screen overflow-hidden'} flex-col bg-white`}>
        <FeedbackHeaderBar
          project={project}
          items={items}
          selectedItem={selectedItem}
          filteredItems={filteredItems}
          typeFilter={typeFilter}
          stripTypes={stripTypes}
          stripVariant={stripVariant}
          currentIdx={currentIdx}
          singleItemOnly={!!singleItemOnly}
          onFilterChange={handleFilterChange}
          onGoToItem={goToItem}
          branding={branding}
          headerBranded={headerBranded}
          hasBranding={hasBranding}
          accent={accent}
          sidebarText={sidebarText}
          bgSecondary={bgSecondary}
          backAction={backAction}
          versions={versions}
          activeVersionId={activeVersionId}
          onVersionChange={onVersionChange}
          onAddVersion={onAddVersion}
          onEditVersion={onEditVersion}
          onUpdateItemStatus={onUpdateItemStatus}
          renderHeaderActions={renderHeaderActions}
          reviewMode={reviewMode}
          onReviewModeChange={onReviewModeChange}
          reviewerName={reviewerName}
          reviewSubmitted={reviewSubmitted}
          onOpenFinishModal={() => setShowFinishModal(true)}
          hasFinishHandler={onReviewSubmitted !== undefined}
        />

        {/* Comments-paused banner (client only — shown immediately below the header rows) */}
        {isClient && project.pause_new_comments && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
            <Pause size={12} />
            The team has paused new comments for this review.
          </div>
        )}

        {/* Mode bar — appears when a drawing tool is active */}
        <FeedbackModeBar
          mode={feedbackMode}
          onCancel={() => changeFeedbackMode('idle')}
          accentColor={branding?.accent_color || accent}
        />

        {/* ── Body: comments (left) + content (right) ── */}
        <div className="flex-1 flex min-h-0">
          {showComments && (
            <CommentsPanel
              unresolvedComments={unresolvedComments}
              resolvedComments={resolvedComments}
              getReplies={getReplies}
              hasComments={topLevelComments.length > 0}
              highlightCommentId={highlightedCommentId}
              onSubmitComment={handleSubmitComment}
              onClose={() => setShowComments(false)}
              authorName={isAdmin ? authorName : undefined}
              guestName={isClient ? guestName : undefined}
              onNameChange={isClient ? onGuestNameChange : undefined}
              onResolve={onResolveComment}
              onUnresolve={onUnresolveComment}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
              isAdmin={isAdmin}
              currentUserEmail={isClient ? reviewerEmail : undefined}
              currentUserName={isClient ? guestName : authorName}
              participantsUrl={participantsUrl}
              shareToken={shareToken}
              className="w-[360px] shrink-0 bg-warm flex flex-col"
              commentPlaceholder={(() => {
                if (selectedItem?.type !== 'google_search_ad') return undefined;
                const asset = parseGoogleAdAssetView(currentMockupView);
                if (!asset) return 'Leave feedback…';
                const label = asset.type === 'headline' ? 'Headline' : 'Description';
                return `Leave feedback on ${label} ${asset.index + 1}…`;
              })()}
              commentFormAlwaysExpanded={selectedItem?.type === 'google_search_ad'}
            />
          )}

          {/* ── Main content area ── */}
          <div
            className={`flex-1 relative ${
              isWebpageItem ? 'overflow-auto p-4' : 'overflow-auto p-6'
            } bg-white min-w-0`}
          >
            {/* Inner wrapper centers content for short items but lets tall
                items (long emails, full SMS threads) flow from the top so
                the toggle / header isn't clipped under the scroll viewport. */}
            <div className={isWebpageItem ? '' : 'min-h-full flex items-center justify-center'}>
              <ItemContentView
                item={selectedItem}
                cursorStyle={
                  feedbackMode === 'highlight' ? 'text'
                    : feedbackMode === 'text' ? 'text'
                    : feedbackMode === 'arrow' || feedbackMode === 'box' ? 'crosshair'
                    : pinActive ? 'crosshair'
                    : 'default'
                }
                pendingPin={pendingPin}
                pinComments={pinComments}
                onImageClick={handleImageClick}
                onPinClick={handlePinClick}
                containerRef={imageContainerRef}
                shareToken={shareToken || ''}
                renderWebpage={isClient ? (item) => <WebpageClientPlaceholder item={item} /> : undefined}
                emptyText="No items to show"
                highlightComments={highlightComments}
                highlightedCommentId={highlightedCommentId}
                onHighlightClick={handlePinClick}
                pendingHighlight={
                  pendingHighlight
                    ? { start: pendingHighlight.startOffset, end: pendingHighlight.endOffset }
                    : null
                }
                accentColor={branding?.accent_color || accent}
                brandName={project.client_company || project.client_name || undefined}
                activeView={activeView}
                onViewChange={setActiveView}
                commentCountsByView={commentCountsByView}
              />
            </div>

            <DrawingOverlay
              mode={feedbackMode}
              containerRef={imageContainerRef}
              onAnnotationComplete={handleAnnotationComplete}
              annotationComments={annotationComments}
              highlightedCommentId={highlightedCommentId}
              onAnnotationClick={handlePinClick}
            />

            {/* Pin comment popover (existing pins) — portaled into the content
                container so percentage-based positioning resolves against the
                same element that PinOverlay uses. */}
            {popoverComment && popoverComment.pin_x != null && popoverComment.pin_y != null && imageContainerRef.current && createPortal(
              <PinCommentPopover
                comment={popoverComment}
                replies={getReplies(popoverComment.id)}
                pinX={popoverComment.pin_x}
                pinY={popoverComment.pin_y}
                containerRef={imageContainerRef}
                onClose={() => setPopoverCommentId(null)}
                onReply={handlePopoverReply}
                onResolve={onResolveComment}
                onUnresolve={onUnresolveComment}
                onDelete={onDeleteComment}
                isAdmin={isAdmin}
                currentUserEmail={isClient ? reviewerEmail : undefined}
                currentUserName={isClient ? guestName : authorName}
                participantsUrl={participantsUrl}
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
                memberLookup={memberLookup}
              />,
              imageContainerRef.current,
            )}

            {/* New-pin popover (anchored at click) */}
            {pendingPin && !pendingHighlight && selectedItemId && imageContainerRef.current && createPortal(
              <PendingPinPopover
                pinX={pendingPin.x}
                pinY={pendingPin.y}
                containerRef={imageContainerRef}
                onSubmit={async (content, attachments, priority, videoUrl) => {
                  await handleSubmitComment(content, pendingPin.x, pendingPin.y, undefined, priority, attachments, videoUrl);
                  handleCancelPin();
                }}
                onCancel={handleCancelPin}
                companyId={companyId}
                shareToken={shareToken}
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
                onOpenDrawing={(mode) => { handleCancelPin(); changeFeedbackMode(mode); }}
                participantsUrl={participantsUrl}
              />,
              imageContainerRef.current,
            )}

            {/* New-highlight popover (anchored at selection) — same composer as pin, with quoted text */}
            {pendingHighlight && selectedItemId && imageContainerRef.current && createPortal(
              <PendingPinPopover
                pinX={pendingHighlight.rectPct.x}
                pinY={pendingHighlight.rectPct.y}
                containerRef={imageContainerRef}
                quotedText={pendingHighlight.text}
                onSubmit={async (content, attachments, priority, videoUrl) => {
                  await handleSubmitComment(content, undefined, undefined, undefined, priority, attachments, videoUrl);
                  setPendingHighlight(null);
                  clearTextSelection();
                }}
                onCancel={() => { setPendingHighlight(null); clearTextSelection(); }}
                companyId={companyId}
                shareToken={shareToken}
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
                participantsUrl={participantsUrl}
              />,
              imageContainerRef.current,
            )}

            <FeedbackToolbar
              onToggleComments={() => setShowComments(!showComments)}
              commentsOpen={showComments}
              unresolvedCount={unresolvedComments.length}
              mode={feedbackMode}
              onModeChange={changeFeedbackMode}
              className="absolute top-6 right-8"
              accentColor={branding?.accent_color || accent}
            />
          </div>

          {/* Vertical thumb strip removed — header prev/next handles navigation. */}
        </div>

      </div>

      {/* Finish-reviewing modal — driven by the header's Finish button */}
      {showFinishModal && isClient && shareToken && onReviewSubmitted && (
        <CompleteFeedbackModal
          shareToken={shareToken}
          reviewerName={reviewerName ?? ''}
          reviewerEmail={reviewerEmail ?? ''}
          accentColor={branding?.accent_color || '#017C87'}
          items={items}
          activeItemId={selectedItemId}
          mode={singleItemOnly ? 'item' : 'project'}
          onClose={() => setShowFinishModal(false)}
          onSubmitted={() => {
            setShowFinishModal(false);
            onReviewSubmitted();
          }}
        />
      )}
    </>
  );
}

