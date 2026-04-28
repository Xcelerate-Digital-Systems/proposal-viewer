'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ExternalLink, Monitor,
  MessageSquare, MousePointer2, ArrowRight, Pause,
} from 'lucide-react';
import CompleteFeedbackModal from './CompleteFeedbackModal';
import type { FeedbackProject, FeedbackItem, FeedbackComment, FeedbackStatus } from '@/lib/supabase';
import type { FeedbackCommentPriority } from '@/lib/types/feedback';
import { REVIEW_STATUS_CONFIG, getFeedbackStatusDef } from '@/lib/feedback/status';
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

  // Auto-open comment form when text is selected — no extra button needed
  useEffect(() => {
    if (textSelection) {
      setPendingHighlight(textSelection);
      setShowComments(true);
      clearTextSelection();
    }
  }, [textSelection, clearTextSelection]);

  const handleSubmitComment = useCallback(
    async (content: string, pinX?: number, pinY?: number, parentId?: string, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => {
      if (!selectedItemId) return;
      const highlight = pendingHighlight
        ? { text: pendingHighlight.text, start: pendingHighlight.startOffset, end: pendingHighlight.endOffset, elementPath: pendingHighlight.elementPath }
        : undefined;
      await onSubmitComment(selectedItemId, content, pinX, pinY, parentId, pendingAnnotation || undefined, pendingScreenshotUrl || undefined, highlight, priority, attachments, videoUrl);
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
  //  HEADER + DETAIL MODE — thumb strip in header, comments on left.
  //  Used for every entry point (admin, public project share, public item
  //  share, deep-link from whiteboard). singleItemOnly hides item cycling
  //  but keeps the same chrome.
  // ══════════════════════════════════════════════════════════════════

  // Determine which types to show in filter — hide when hideFilterBar is set
  const stripTypes = hideFilterBar ? [] : (isAdmin && typeFilter ? [] : availableTypes);

  const stripVariant: 'admin' | 'branded' = isAdmin || !hasBranding ? 'admin' : 'branded';
  const projectStatusDef = project.status ? getFeedbackStatusDef(project.status) : null;
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
        {/* ── Row 1: brand + title + status | version + status control + actions | (client) Comment/Browse + avatar + Finish ── */}
        <div
          className={`flex items-center gap-3 px-4 py-2 shrink-0 ${
            headerBranded ? '' : 'border-b border-gray-200 bg-white'
          }`}
          style={headerBranded ? { backgroundColor: bgSecondary, borderBottom: `1px solid ${sidebarText}15` } : undefined}
        >
          {/* Back + branding */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            {backAction ? (
              <button
                onClick={backAction.onClick}
                className={`flex items-center gap-1.5 text-sm transition-colors min-w-0 ${
                  headerBranded ? '' : 'text-gray-500 hover:text-gray-700'
                }`}
                style={headerBranded ? { color: `${sidebarText}99` } : undefined}
              >
                <ArrowLeft size={14} className="shrink-0" />
                <span className="font-medium truncate max-w-[180px]">{backAction.label}</span>
              </button>
            ) : null}

            {hasBranding && branding?.logo_url && (
              <>
                {backAction && <span style={{ color: `${sidebarText}40` }}>·</span>}
                <img
                  src={branding.logo_url}
                  alt={branding.name}
                  className="h-5 w-auto max-w-[100px] object-contain"
                />
              </>
            )}
            {hasBranding && !branding?.logo_url && branding?.name && (
              <>
                {backAction && <span style={{ color: `${sidebarText}40` }}>·</span>}
                <span
                  className="text-sm font-semibold"
                  style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}
                >
                  {branding.name}
                </span>
              </>
            )}

            {/* Project title (always shown — replaces ReviewTopBar's title) */}
            <span
              className={`h-4 w-px ${headerBranded ? '' : 'bg-gray-200'}`}
              style={headerBranded ? { backgroundColor: `${sidebarText}25` } : undefined}
            />
            <span
              className={`text-sm font-medium truncate max-w-[200px] ${headerBranded ? '' : 'text-gray-900'}`}
              style={headerBranded ? { color: sidebarText } : undefined}
            >
              {project.title}
            </span>
            {project.client_name && (
              <span
                className={`text-xs truncate hidden xl:inline ${headerBranded ? '' : 'text-gray-400'}`}
                style={headerBranded ? { color: `${sidebarText}80` } : undefined}
              >
                · {project.client_name}
              </span>
            )}
            {projectStatusDef && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${projectStatusDef.bg} ${projectStatusDef.text} ${projectStatusDef.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${projectStatusDef.dot}`} />
                {projectStatusDef.label}
              </span>
            )}
          </div>

          {/* Filters + prev/next + count (middle cluster) */}
          {!singleItemOnly && stripTypes.length > 1 && (
            <>
              <div
                className={`w-px h-6 shrink-0 ${headerBranded ? '' : 'bg-gray-200'}`}
                style={headerBranded ? { backgroundColor: `${sidebarText}25` } : undefined}
              />
              <div className="shrink-0">
                <TypeFilterTabs
                  items={items}
                  availableTypes={stripTypes}
                  typeFilter={typeFilter}
                  onFilterChange={handleFilterChange}
                  variant={stripVariant}
                  sidebarTextColor={headerBranded ? sidebarText : undefined}
                  showCounts={false}
                />
              </div>
            </>
          )}

          {!singleItemOnly && filteredItems.length > 1 && (
            <>
              <div
                className={`w-px h-6 shrink-0 ${headerBranded ? '' : 'bg-gray-200'}`}
                style={headerBranded ? { backgroundColor: `${sidebarText}25` } : undefined}
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => goToItem(currentIdx - 1)}
                  disabled={currentIdx <= 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                    headerBranded ? '' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={headerBranded ? {
                    border: `1px solid ${sidebarText}25`,
                    color: sidebarText,
                  } : undefined}
                >
                  <ChevronLeft size={13} />
                  Previous
                </button>
                <span
                  className={`text-xs tabular-nums whitespace-nowrap ${headerBranded ? '' : 'text-gray-400'}`}
                  style={headerBranded ? { color: `${sidebarText}80` } : undefined}
                >
                  {currentIdx + 1} of {filteredItems.length}
                </span>
                <button
                  onClick={() => goToItem(currentIdx + 1)}
                  disabled={currentIdx >= filteredItems.length - 1}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                    headerBranded ? '' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={headerBranded ? {
                    border: `1px solid ${sidebarText}25`,
                    color: sidebarText,
                  } : undefined}
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Trailing controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Version picker */}
            {versions && versions.length > 0 && onVersionChange && (
              <div className="shrink-0">
                <VersionPicker
                  versions={versions}
                  activeVersionId={activeVersionId}
                  onChange={onVersionChange}
                  onAddVersion={onAddVersion}
                  compact
                />
              </div>
            )}

            {/* Client status picker */}
            {onUpdateItemStatus && selectedItem && (
              <div className="shrink-0">
                <ClientStatusControl
                  itemId={selectedItem.id}
                  status={selectedItem.status}
                  onChange={onUpdateItemStatus}
                />
              </div>
            )}

            {/* Custom actions (admin: share button etc.) */}
            {renderHeaderActions && (
              <div className="flex items-center gap-2 shrink-0">
                {renderHeaderActions(selectedItem)}
              </div>
            )}

            {/* ── Review controls (Comment/Browse pill + reviewer avatar + Finish) ── */}
            {onReviewModeChange && reviewMode && (
              <div
                className="flex items-center rounded-full p-0.5 shrink-0"
                style={{ backgroundColor: `${sidebarText}15` }}
              >
                <button
                  type="button"
                  onClick={() => onReviewModeChange('comment')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors"
                  style={reviewMode === 'comment' ? { backgroundColor: `${sidebarText}26`, color: sidebarText } : { color: `${sidebarText}99` }}
                >
                  <MessageSquare size={12} />
                  Comment
                </button>
                <button
                  type="button"
                  onClick={() => onReviewModeChange('browse')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors"
                  style={reviewMode === 'browse' ? { backgroundColor: `${sidebarText}26`, color: sidebarText } : { color: `${sidebarText}99` }}
                >
                  <MousePointer2 size={12} />
                  Browse
                </button>
              </div>
            )}

            {reviewerName !== undefined && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: branding?.accent_color || '#017C87' }}
                title={reviewerName || 'Reviewer'}
              >
                {(reviewerName.trim()[0] ?? 'R').toUpperCase()}
              </div>
            )}

            {onReviewSubmitted !== undefined && (
              reviewSubmitted ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12px] font-semibold shrink-0">
                  Review submitted
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowFinishModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px] font-semibold hover:brightness-110 transition-all shadow-sm shrink-0"
                  style={{ backgroundColor: branding?.accent_color || '#017C87' }}
                >
                  Finish reviewing
                  <ArrowRight size={12} />
                </button>
              )
            )}
          </div>
        </div>

        {/* Comments-paused banner (client only — shown immediately below the header rows) */}
        {isClient && project.pause_new_comments && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-[12px] font-medium px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
            <Pause size={12} />
            The team has paused new comments for this review.
          </div>
        )}

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
                onDelete={isAdmin ? onDeleteComment : undefined}
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
                onSubmit={async (content, attachments, priority, videoUrl) => {
                  await handleSubmitComment(content, pendingPin.x, pendingPin.y, undefined, priority, attachments, videoUrl);
                }}
                onCancel={handleCancelPin}
                companyId={companyId}
                shareToken={shareToken}
                authorName={isAdmin ? authorName : undefined}
                guestName={isClient ? guestName : undefined}
                onNameChange={isClient ? onGuestNameChange : undefined}
                onOpenDrawing={(mode) => { handleCancelPin(); changeFeedbackMode(mode); }}
              />
            )}

            {/* New-highlight popover (anchored at selection) — same composer as pin, with quoted text */}
            {pendingHighlight && selectedItemId && (
              <PendingPinPopover
                pinX={pendingHighlight.rectPct.x}
                pinY={pendingHighlight.rectPct.y}
                containerRef={imageContainerRef}
                quotedText={pendingHighlight.text}
                onSubmit={async (content, attachments, priority, videoUrl) => {
                  await handleSubmitComment(content, undefined, undefined, undefined, priority, attachments, videoUrl);
                }}
                onCancel={() => setPendingHighlight(null)}
                companyId={companyId}
                shareToken={shareToken}
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
              className="absolute top-4 left-4"
            />
          </div>

          {/* ── Right: vertical thumb strip (hidden in single-item) ── */}
          {!singleItemOnly && filteredItems.length > 1 && (
            <div
              className={`shrink-0 ${headerBranded ? '' : 'border-l border-gray-200 bg-white'}`}
              style={headerBranded ? {
                backgroundColor: bgSecondary,
                borderLeft: `1px solid ${sidebarText}15`,
              } : undefined}
            >
              <ItemThumbStrip
                filteredItems={filteredItems}
                selectedItemId={selectedItemId}
                onSelectItem={handleSidebarSelect}
                comments={stripComments}
                variant={stripVariant}
                orientation="vertical"
                textColor={headerBranded ? sidebarText : undefined}
                accentColor={headerBranded ? accent : undefined}
                fontSidebar={hasBranding && branding ? fontFamily(branding.font_sidebar) : undefined}
                className="h-full w-[88px]"
              />
            </div>
          )}
        </div>

      </div>

      {/* Finish-reviewing modal — driven by the header's Finish button */}
      {showFinishModal && isClient && shareToken && onReviewSubmitted && (
        <CompleteFeedbackModal
          shareToken={shareToken}
          reviewerName={reviewerName ?? ''}
          reviewerEmail={reviewerEmail ?? ''}
          accentColor={branding?.accent_color || '#017C87'}
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

/* ─── Client status picker ─────────────────────────────────────────── */

// Limited set of statuses a client is allowed to set from the review link.
// Mirrors the allowlist in /api/review/[token]/items/[itemId]/status.
const CLIENT_STATUS_OPTIONS: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

function ClientStatusControl({
  itemId,
  status,
  onChange,
}: {
  itemId: string;
  status: FeedbackStatus;
  onChange: (itemId: string, next: FeedbackStatus) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = REVIEW_STATUS_CONFIG[status];

  const handlePick = async (next: FeedbackStatus) => {
    setOpen(false);
    if (next === status) return;
    try {
      setPending(true);
      await onChange(itemId, next);
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={ref} className="relative inline-block" data-no-pin>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${current.bg} ${current.text} ${current.border} hover:brightness-95 disabled:opacity-60`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
        {current.label}
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-50 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {CLIENT_STATUS_OPTIONS.map((opt) => {
            const def = REVIEW_STATUS_CONFIG[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handlePick(opt)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 transition-colors ${
                  opt === status ? 'bg-gray-50' : ''
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${def.dot}`} />
                <span className="text-gray-700 truncate">{def.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}