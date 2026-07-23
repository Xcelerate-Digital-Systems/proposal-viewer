'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FeedbackComment } from '@/lib/supabase';
import type { FeedbackItem } from '@/lib/supabase';
import type { FeedbackCommentPriority, FeedbackItemView } from '@/lib/types/feedback';
import { getCommentView } from '@/lib/types/feedback';
import type { VersionView } from '@/lib/feedback/versions';
import type { AnnotationData, FeedbackMode } from '@/components/feedback/tools';
import type { TextHighlightData } from '@/hooks/useTextHighlight';
import type { PendingPin } from '@/hooks/usePinFeedback';
import type { Dispatch, SetStateAction } from 'react';

/* ─── Hook params ──────────────────────────────────────────────── */

interface UseFeedbackDetailCommentsParams {
  comments: FeedbackComment[];
  selectedItemId: string | null;
  selectedItem: FeedbackItem | null;
  currentMockupView: FeedbackItemView;
  versions?: VersionView[];
  activeVersionId?: string | null;
  activeVersion: VersionView | null;
  // Pin feedback state from usePinFeedback
  pendingPin: PendingPin | null;
  setPendingPin: (pin: PendingPin | null) => void;
  pinActive: boolean;
  changeFeedbackMode: (mode: FeedbackMode) => void;
  imageContainerRef: React.RefObject<HTMLElement | null>;
  // Screenshot capture
  captureScreenshot: (element: HTMLElement | null, opts?: { cropAroundPct?: { x: number; y: number } }) => Promise<string | null>;
  // Text highlight
  textSelection: TextHighlightData | null;
  resetTextSelection: () => void;
  // External callbacks
  onSubmitComment: (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => Promise<void>;
  // Browse mode & comment locking
  browseMode: boolean;
  commentsLocked: boolean;
  baseHandleImageClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  // Active view setter (from selection hook)
  setActiveView: Dispatch<SetStateAction<FeedbackItemView>>;
  // Toast
  toast: { success: (msg: string) => void };
}

/* ─── Hook return ──────────────────────────────────────────────── */

export interface FeedbackDetailCommentsState {
  showComments: boolean;
  setShowComments: React.Dispatch<React.SetStateAction<boolean>>;
  pinHintDismissed: boolean;
  setPinHintDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  pendingAnnotation: AnnotationData | null;
  pendingHighlight: TextHighlightData | null;
  setPendingHighlight: React.Dispatch<React.SetStateAction<TextHighlightData | null>>;
  pendingScreenshotUrl: string | null;
  popoverCommentId: string | null;
  setPopoverCommentId: React.Dispatch<React.SetStateAction<string | null>>;
  highlightedCommentId: string | null;
  setHighlightedCommentId: React.Dispatch<React.SetStateAction<string | null>>;
  handleAnnotationComplete: (pinX: number, pinY: number, annotation: AnnotationData) => void;
  handleSubmitComment: (content: string, pinX?: number, pinY?: number, parentId?: string, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => Promise<void>;
  handleImageClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handlePinClick: (commentId?: string) => void;
  handlePopoverReply: (content: string, parentId: string, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[]) => Promise<void>;
  popoverComment: FeedbackComment | null;
  annotationComments: FeedbackComment[];
  highlightComments: FeedbackComment[];
  commentCountsByView: Record<string, number>;
  versionScopedComments: FeedbackComment[];
  clearTextSelection: () => void;
}

/* ─── Hook ─────────────────────────────────────────────────────── */

export function useFeedbackDetailComments({
  comments,
  selectedItemId,
  selectedItem,
  currentMockupView,
  versions,
  activeVersionId = null,
  activeVersion,
  pendingPin,
  setPendingPin,
  pinActive,
  changeFeedbackMode,
  imageContainerRef,
  captureScreenshot,
  textSelection,
  resetTextSelection,
  onSubmitComment,
  browseMode,
  commentsLocked,
  baseHandleImageClick,
  setActiveView,
  toast,
}: UseFeedbackDetailCommentsParams): FeedbackDetailCommentsState {
  const [showComments, setShowComments] = useState(true);
  const [pinHintDismissed, setPinHintDismissed] = useState(() => {
    try {
      return localStorage.getItem('feedback-pin-hint-dismissed') === '1';
    } catch {
      return false;
    }
  });

  // ── Drawing annotation state ──
  const [pendingAnnotation, setPendingAnnotation] = useState<AnnotationData | null>(null);
  const [pendingHighlight, setPendingHighlight] = useState<TextHighlightData | null>(null);
  const [pendingScreenshotUrl, setPendingScreenshotUrl] = useState<string | null>(null);

  // ── Pin popover state ──
  const [popoverCommentId, setPopoverCommentId] = useState<string | null>(null);

  // ── Pin-to-comment scroll state ──
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Handle annotation completion from DrawingOverlay
  const handleAnnotationComplete = useCallback(
    (pinX: number, pinY: number, annotation: AnnotationData) => {
      setPendingPin({ x: pinX, y: pinY });
      setPendingAnnotation(annotation);
      setShowComments(true);
      changeFeedbackMode('idle');
    },
    [setPendingPin, changeFeedbackMode],
  );

  // ── Pin click → always open comments when pin is placed ──
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (browseMode) return;
      if (commentsLocked) return;

      baseHandleImageClick(e);
      // Don't force-open the comments panel on pin placement — the pending
      // pin popover is sufficient for composing the comment. Only keep it
      // open if the reviewer already had the panel open.
      if (!pinHintDismissed) {
        setPinHintDismissed(true);
        try {
          localStorage.setItem('feedback-pin-hint-dismissed', '1');
        } catch {}
      }
    },
    [browseMode, commentsLocked, baseHandleImageClick, pinActive, pinHintDismissed],
  );

  // Auto-open comment form when text is selected — no extra button needed.
  useEffect(() => {
    if (textSelection) {
      setPendingHighlight(textSelection);
      setShowComments(true);
      resetTextSelection();
    }
  }, [textSelection, resetTextSelection]);

  const handleSubmitComment = useCallback(
    async (
      content: string,
      pinX?: number,
      pinY?: number,
      parentId?: string,
      priority?: FeedbackCommentPriority,
      attachments?: import('@/lib/supabase').FeedbackCommentAttachment[],
      videoUrl?: string | null,
    ) => {
      if (!selectedItemId) return;
      const highlight = pendingHighlight
        ? {
            text: pendingHighlight.text,
            start: pendingHighlight.startOffset,
            end: pendingHighlight.endOffset,
            elementPath: pendingHighlight.elementPath,
          }
        : undefined;

      // Stamp pins / annotations / highlights with the view they were placed on
      const isGoogleSearchAd = selectedItem?.type === 'google_search_ad';
      const isAnnotation = pinX != null || !!pendingAnnotation || !!highlight;
      const isCreativePin = pendingPin?.target === 'creative' && pinX != null;
      const shouldStampView = (isAnnotation || isGoogleSearchAd) && (isCreativePin || currentMockupView != null);
      const stampedView = isCreativePin ? 'creative' : currentMockupView;
      const annotationPayload = shouldStampView
        ? { ...(pendingAnnotation || {}), view: stampedView }
        : pendingAnnotation || undefined;

      await onSubmitComment(
        selectedItemId,
        content,
        pinX,
        pinY,
        parentId,
        annotationPayload,
        pendingScreenshotUrl || undefined,
        highlight,
        priority,
        attachments,
        videoUrl,
      );
      if (!parentId) toast.success(pinX != null ? 'Comment pinned' : 'Comment added');
      setPendingAnnotation(null);
      setPendingScreenshotUrl(null);
      setPendingHighlight(null);
    },
    [selectedItemId, selectedItem, currentMockupView, onSubmitComment, pendingAnnotation, pendingScreenshotUrl, pendingHighlight, pendingPin, toast],
  );

  // ── Screenshot capture — fires after React commits the pending pin ──
  useEffect(() => {
    if (!pendingPin) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        captureScreenshot(imageContainerRef.current, {
          cropAroundPct: { x: pendingPin.x, y: pendingPin.y },
        }).then((url) => {
          if (url && !cancelled) setPendingScreenshotUrl(url);
        });
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPin]);

  // ── Existing pin clicked → switch to its view (if scoped), then show popover ──
  const handlePinClick = useCallback(
    (commentId?: string) => {
      if (!commentId) return;
      const c = comments.find((x) => x.id === commentId);
      const pinView = c ? getCommentView(c.annotation_data) : null;
      if (pinView) setActiveView(pinView);
      setPopoverCommentId((prev) => (prev === commentId ? null : commentId));
    },
    [comments, setActiveView],
  );

  // ── Reply via popover ──
  const handlePopoverReply = useCallback(
    async (content: string, parentId: string, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[]) => {
      if (!selectedItemId) return;
      await onSubmitComment(selectedItemId, content, undefined, undefined, parentId, undefined, undefined, undefined, undefined, attachments);
    },
    [selectedItemId, onSubmitComment],
  );

  // Find the comment for the popover
  const popoverComment = useMemo(
    () => (popoverCommentId ? comments.find((c) => c.id === popoverCommentId) || null : null),
    [popoverCommentId, comments],
  );

  // Close popover when item changes
  useEffect(() => {
    setPopoverCommentId(null);
  }, [selectedItemId]);

  // Filter annotation comments (drawings — arrow / box / text). Scoped to the
  // active version + the current sub-view.
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

  // Filter text_highlight comments (scoped to active version)
  const highlightComments = useMemo(
    () =>
      comments.filter(
        (c) =>
          c.review_item_id === selectedItemId &&
          c.comment_type === 'text_highlight' &&
          (!versions || versions.length <= 1 || (c.version_id ?? null) === (activeVersionId ?? null)),
      ),
    [comments, selectedItemId, versions, activeVersionId],
  );

  // Unresolved comment counts per asset view, for the Google Search ad
  // sidebar badges.
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

  // Comments are pinned to the version they were made on — filter the feed to
  // whichever version is currently showing so pins / highlights line up.
  const versionScopedComments = useMemo(() => {
    if (!versions || versions.length <= 1) return comments;
    const activeId = activeVersion?.id ?? null;
    return comments.filter((c) => (c.version_id ?? null) === activeId);
  }, [comments, versions, activeVersion]);

  // Stub clearTextSelection — the actual function is passed through from the
  // parent component via the textHighlight hook. We expose it here so the
  // render code can call it from the pending-highlight popover's onCancel.
  // The real clearSelection comes from useTextHighlight in the parent.
  const clearTextSelection = useCallback(() => {
    setPendingHighlight(null);
  }, []);

  return {
    showComments,
    setShowComments,
    pinHintDismissed,
    setPinHintDismissed,
    pendingAnnotation,
    pendingHighlight,
    setPendingHighlight,
    pendingScreenshotUrl,
    popoverCommentId,
    setPopoverCommentId,
    highlightedCommentId,
    setHighlightedCommentId,
    handleAnnotationComplete,
    handleSubmitComment,
    handleImageClick,
    handlePinClick,
    handlePopoverReply,
    popoverComment,
    annotationComments,
    highlightComments,
    commentCountsByView,
    versionScopedComments,
    clearTextSelection,
  };
}
