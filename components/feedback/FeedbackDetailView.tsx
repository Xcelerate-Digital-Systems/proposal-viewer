'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Monitor,
} from 'lucide-react';
import type { FeedbackProject, FeedbackItem, FeedbackComment } from '@/lib/supabase';
import { applyVersion, type VersionView } from '@/lib/feedback/versions';
import VersionPicker from '@/components/feedback/VersionPicker';
import type { CompanyBranding } from '@/hooks/useProposal';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import { useScreenshotCapture } from '@/hooks/useScreenshotCapture';
import { useCommentFilters } from '@/hooks/useCommentFilters';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { CommentsPanel } from '@/components/feedback/comments';
import ItemContentView from '@/components/feedback/ItemContentView';
import ItemThumbStrip from '@/components/feedback/ItemThumbStrip';
import TypeFilterTabs from '@/components/feedback/TypeFilterTabs';
import PinCommentPopover from '@/components/feedback/PinCommentPopover';
import PendingPinPopover from '@/components/feedback/PendingPinPopover';
import PendingHighlightPopover from '@/components/feedback/PendingHighlightPopover';
import WebpageClientPlaceholder from '@/components/feedback/WebpageClientPlaceholder';
import { FeedbackToolbar, FeedbackModeBar, DrawingOverlay, HighlightOverlay } from '@/components/feedback/tools';
import type { AnnotationData } from '@/components/feedback/tools';
import { useTextHighlight, type TextHighlightData } from '@/hooks/useTextHighlight';

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
  onSubmitComment: (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }) => Promise<void>;
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
  renderHeaderActions,
  companyId,
  versions,
  activeVersionId = null,
  onVersionChange,
  onAddVersion,
}: ReviewDetailViewProps) {
  const isAdmin = mode === 'admin';
  const isClient = mode === 'client';

  // ── Selection state ──
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialItemId || items[0]?.id || null
  );
  const [typeFilter, setTypeFilter] = useState<string | null>(initialTypeFilter || null);
  const [showComments, setShowComments] = useState(true);

  // ── Branding colors (client mode) ──
  const brandingColors = useBrandingColors(branding ?? {} as CompanyBranding);
  const { accent, border, sidebarText } = brandingColors;

  // Use admin-style sidebar when no branding is provided (unbranded client mode)
  const hasBranding = isClient && branding?.logo_url || branding?.name;

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
  const [pendingScreenshotUrl, setPendingScreenshotUrl] = useState<string | null>(null);

  // ── Drawing annotation state ──
  const [pendingAnnotation, setPendingAnnotation] = useState<AnnotationData | null>(null);

  // Filter annotation comments (have annotation_data) — note this runs BEFORE
  // `versionScopedComments` is declared because of the file order; we inline
  // the version filter here so pins/drawings on v2 don't leak into v1's view.
  const annotationComments = useMemo(
    () => comments.filter((c) =>
      c.review_item_id === selectedItemId &&
      (c as unknown as Record<string, unknown>).annotation_data != null &&
      (!versions || versions.length <= 1 || (c.version_id ?? null) === (activeVersionId ?? null))
    ),
    [comments, selectedItemId, versions, activeVersionId]
  );

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

  // ── Text highlight state (available for all content types) ──
  const { selection: textSelection, clearSelection: clearTextSelection } = useTextHighlight({
    containerRef: imageContainerRef as React.RefObject<HTMLElement>,
    enabled: feedbackMode === 'idle',
  });

  // Filter text_highlight comments (scoped to active version)
  const highlightComments = useMemo(
    () => comments.filter((c) =>
      c.review_item_id === selectedItemId && c.comment_type === 'text_highlight' &&
      (!versions || versions.length <= 1 || (c.version_id ?? null) === (activeVersionId ?? null))
    ),
    [comments, selectedItemId, versions, activeVersionId]
  );

  // Auto-open comment form when text is selected — no extra button needed
  useEffect(() => {
    if (textSelection) {
      setPendingHighlight(textSelection);
      setShowComments(true);
      clearTextSelection();
    }
  }, [textSelection, clearTextSelection]);

  const handleSubmitComment = useCallback(
    async (content: string, pinX?: number, pinY?: number, parentId?: string) => {
      if (!selectedItemId) return;
      const highlight = pendingHighlight
        ? { text: pendingHighlight.text, start: pendingHighlight.startOffset, end: pendingHighlight.endOffset, elementPath: pendingHighlight.elementPath }
        : undefined;
      await onSubmitComment(selectedItemId, content, pinX, pinY, parentId, pendingAnnotation || undefined, pendingScreenshotUrl || undefined, highlight);
      setPendingAnnotation(null);
      setPendingScreenshotUrl(null);
      setPendingHighlight(null);
    },
    [selectedItemId, onSubmitComment, pendingAnnotation, pendingScreenshotUrl, pendingHighlight]
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

  // ── Pin click → always open comments when pin is placed ──
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    baseHandleImageClick(e);
    if (pinActive) {
      setShowComments(true);
      // Auto-capture screenshot of the content area
      captureScreenshot(imageContainerRef.current).then((url) => {
        if (url) setPendingScreenshotUrl(url);
      });
    }
  }, [baseHandleImageClick, pinActive, captureScreenshot, imageContainerRef]);

  // ── Existing pin clicked → show popover ──
  const handlePinClick = useCallback((commentId?: string) => {
    if (commentId) {
      setPopoverCommentId((prev) => prev === commentId ? null : commentId);
    }
  }, []);

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

  // Close popover when item changes
  useEffect(() => {
    setPopoverCommentId(null);
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
    <div className="flex lg:hidden min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border-2 border-gray-300">
          <Monitor size={24} className="text-gray-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Desktop Required</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Please open this feedback on a desktop browser for the best experience.
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  //  SINGLE ITEM MODE (no sidebar — individual item share)
  // ══════════════════════════════════════════════════════════════════
  if (singleItemOnly && selectedItem) {
    return (
      <>
        {isClient && branding && (
          <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />
        )}

        {MobileGate}

        <div className={`hidden lg:flex ${isAdmin ? 'h-full' : 'h-screen overflow-hidden'} flex-col bg-gray-50`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {hasBranding && branding?.logo_url ? (
                <img src={branding.logo_url} alt={branding.name} className="h-6 w-auto max-w-[120px] object-contain" />
              ) : hasBranding && branding?.name ? (
                <span className="text-sm font-semibold text-gray-800"
                  style={{ fontFamily: fontFamily(branding.font_heading) }}>
                  {branding.name}
                </span>
              ) : null}
              {hasBranding && <span className="text-gray-200">·</span>}
              <span className="text-sm font-semibold text-gray-900 truncate">{selectedItem.title}</span>
            </div>
            {renderHeaderActions?.(selectedItem)}
          </div>

          <FeedbackModeBar mode={feedbackMode} onCancel={() => changeFeedbackMode('idle')} />

          <div className="flex-1 flex min-h-0">
            <div className={`flex-1 relative ${isWebpageItem ? 'overflow-auto p-4' : 'overflow-auto flex items-center justify-center p-8'} bg-gray-50`}>
              <ItemContentView
                item={selectedItem}
                placingPin={pinActive}
                pendingPin={pendingPin}
                pinComments={pinComments}
                onImageClick={handleImageClick}
                onPinClick={handlePinClick}
                containerRef={imageContainerRef}
                shareToken={shareToken || ''}
                renderWebpage={isClient ? (item) => <WebpageClientPlaceholder item={item} /> : undefined}
                highlightComments={highlightComments}
                highlightedCommentId={highlightedCommentId}
                onHighlightClick={handlePinClick}
              />

              <DrawingOverlay
                mode={feedbackMode}
                containerRef={imageContainerRef}
                onAnnotationComplete={handleAnnotationComplete}
                annotationComments={annotationComments}
                highlightedCommentId={highlightedCommentId}
                onAnnotationClick={handlePinClick}
              />

              {/* Pin comment popover (existing pins) */}
              {popoverComment && popoverComment.pin_x != null && popoverComment.pin_y != null && (
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
                  authorName={isAdmin ? authorName : undefined}
                  guestName={isClient ? guestName : undefined}
                  onNameChange={isClient ? onGuestNameChange : undefined}
                />
              )}

              {/* New-pin popover (anchored at click) */}
              {pendingPin && !pendingHighlight && selectedItemId && (
                <PendingPinPopover
                  pinX={pendingPin.x}
                  pinY={pendingPin.y}
                  containerRef={imageContainerRef}
                  onSubmit={async (content) => {
                    await handleSubmitComment(content, pendingPin.x, pendingPin.y);
                  }}
                  onCancel={handleCancelPin}
                  companyId={companyId}
                  authorName={isAdmin ? authorName : undefined}
                  guestName={isClient ? guestName : undefined}
                  onNameChange={isClient ? onGuestNameChange : undefined}
                />
              )}

              {/* New-highlight popover (anchored at selection) */}
              {pendingHighlight && selectedItemId && (
                <PendingHighlightPopover
                  pinX={pendingHighlight.rectPct.x}
                  pinY={pendingHighlight.rectPct.y}
                  containerRef={imageContainerRef}
                  highlightText={pendingHighlight.text}
                  onSubmit={async (content) => {
                    await handleSubmitComment(content);
                  }}
                  onCancel={() => setPendingHighlight(null)}
                  companyId={companyId}
                  authorName={isAdmin ? authorName : undefined}
                  guestName={isClient ? guestName : undefined}
                  onNameChange={isClient ? onGuestNameChange : undefined}
                />
              )}

              <FeedbackToolbar
                onToggleComments={() => setShowComments(!showComments)}
                commentsOpen={showComments}
                unresolvedCount={unresolvedComments.length}
                mode={feedbackMode}
                onModeChange={changeFeedbackMode}
                className="absolute top-4 right-4"
              />
            </div>

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
              onEdit={isAdmin ? onEditComment : undefined}
              onDelete={isAdmin ? onDeleteComment : undefined}
              companyId={companyId}
              closable={false}
              className={`${showComments ? 'flex' : 'hidden'} w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white`}
            />
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  HEADER + DETAIL MODE (default) — thumb strip in header, comments on left
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

      <div className={`hidden lg:flex ${isAdmin ? 'h-full' : 'h-screen overflow-hidden'} flex-col bg-gray-50`}>
        {/* ── Single-row header: back/logo · filters · ◄ thumbs ► · count · actions ── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          {/* Back + branding */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            {backAction ? (
              <button
                onClick={backAction.onClick}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors min-w-0"
              >
                <ArrowLeft size={14} className="shrink-0" />
                <span className="font-medium truncate max-w-[180px]">{backAction.label}</span>
              </button>
            ) : (
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">
                {project.title}
              </span>
            )}
            {hasBranding && branding?.logo_url && (
              <>
                <span className="text-gray-200">·</span>
                <img
                  src={branding.logo_url}
                  alt={branding.name}
                  className="h-5 w-auto max-w-[100px] object-contain"
                />
              </>
            )}
            {hasBranding && !branding?.logo_url && branding?.name && (
              <>
                <span className="text-gray-200">·</span>
                <span
                  className="text-sm font-semibold text-gray-800"
                  style={{ fontFamily: fontFamily(branding.font_heading) }}
                >
                  {branding.name}
                </span>
              </>
            )}
          </div>

          {/* Filters */}
          {stripTypes.length > 1 && (
            <>
              <div className="w-px h-6 bg-gray-200 shrink-0" />
              <div className="shrink-0">
                <TypeFilterTabs
                  items={items}
                  availableTypes={stripTypes}
                  typeFilter={typeFilter}
                  onFilterChange={handleFilterChange}
                  variant={stripVariant}
                  sidebarTextColor={hasBranding ? sidebarText : undefined}
                  showCounts={false}
                />
              </div>
            </>
          )}

          {/* Thumb strip */}
          <div className="w-px h-6 bg-gray-200 shrink-0" />
          <ItemThumbStrip
            filteredItems={filteredItems}
            selectedItemId={selectedItemId}
            onSelectItem={handleSidebarSelect}
            comments={stripComments}
            variant={stripVariant}
            textColor={hasBranding ? sidebarText : undefined}
            accentColor={hasBranding ? accent : undefined}
            fontSidebar={hasBranding && branding ? fontFamily(branding.font_sidebar) : undefined}
            className="flex-1 min-w-0"
          />

          {/* Nav cluster — Previous / count / Next — swipe-file style */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => goToItem(currentIdx - 1)}
              disabled={currentIdx <= 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
              Previous
            </button>
            <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
              {currentIdx + 1} of {filteredItems.length}
            </span>
            <button
              onClick={() => goToItem(currentIdx + 1)}
              disabled={currentIdx >= filteredItems.length - 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Version picker — rendered only when the parent passes versions. */}
          {versions && versions.length > 0 && onVersionChange && (
            <>
              <div className="w-px h-6 bg-gray-200 shrink-0" />
              <div className="shrink-0">
                <VersionPicker
                  versions={versions}
                  activeVersionId={activeVersionId}
                  onChange={onVersionChange}
                  onAddVersion={onAddVersion}
                  compact
                />
              </div>
            </>
          )}

          {/* Actions */}
          {renderHeaderActions && (
            <>
              <div className="w-px h-6 bg-gray-200 shrink-0" />
              <div className="flex items-center gap-2 shrink-0">
                {renderHeaderActions(selectedItem)}
              </div>
            </>
          )}
        </div>

        {/* Mode bar — appears when a drawing tool is active */}
        <FeedbackModeBar
          mode={feedbackMode}
          onCancel={() => changeFeedbackMode('idle')}
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
              onEdit={isAdmin ? onEditComment : undefined}
              onDelete={isAdmin ? onDeleteComment : undefined}
              companyId={companyId}
              className="w-[340px] shrink-0 border-r border-gray-200 bg-white flex flex-col"
            />
          )}

          {/* ── Main content area ── */}
          <div
            className={`flex-1 relative ${
              isWebpageItem ? 'overflow-auto p-4' : 'overflow-auto flex items-center justify-center p-6'
            } bg-gray-50 min-w-0`}
          >
            <ItemContentView
              item={selectedItem}
              placingPin={pinActive}
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
            />

            <DrawingOverlay
              mode={feedbackMode}
              containerRef={imageContainerRef}
              onAnnotationComplete={handleAnnotationComplete}
              annotationComments={annotationComments}
              highlightedCommentId={highlightedCommentId}
              onAnnotationClick={handlePinClick}
            />

            {/* Pin comment popover (existing pins) */}
            {popoverComment && popoverComment.pin_x != null && popoverComment.pin_y != null && (
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
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
              />
            )}

            {/* New-pin popover (anchored at click) */}
            {pendingPin && !pendingHighlight && selectedItemId && (
              <PendingPinPopover
                pinX={pendingPin.x}
                pinY={pendingPin.y}
                containerRef={imageContainerRef}
                onSubmit={async (content) => {
                  await handleSubmitComment(content, pendingPin.x, pendingPin.y);
                }}
                onCancel={handleCancelPin}
                companyId={companyId}
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
              />
            )}

            {/* New-highlight popover (anchored at selection) */}
            {pendingHighlight && selectedItemId && (
              <PendingHighlightPopover
                pinX={pendingHighlight.rectPct.x}
                pinY={pendingHighlight.rectPct.y}
                containerRef={imageContainerRef}
                highlightText={pendingHighlight.text}
                onSubmit={async (content) => {
                  await handleSubmitComment(content);
                }}
                onCancel={() => setPendingHighlight(null)}
                companyId={companyId}
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
              />
            )}

            <FeedbackToolbar
              onToggleComments={() => setShowComments(!showComments)}
              commentsOpen={showComments}
              unresolvedCount={unresolvedComments.length}
              mode={feedbackMode}
              onModeChange={changeFeedbackMode}
              className="absolute top-4 right-4"
            />
          </div>
        </div>
      </div>
    </>
  );
}