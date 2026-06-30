'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Pause, MapPin } from 'lucide-react';
import CompleteFeedbackModal from './CompleteFeedbackModal';
import FeedbackHeaderBar from './FeedbackHeaderBar';
import type { FeedbackComment } from '@/lib/supabase';
import { parseGoogleAdAssetView } from '@/lib/types/feedback';
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
import { useTextHighlight } from '@/hooks/useTextHighlight';
import { useTeamMemberLookup } from '@/hooks/useTeamMemberLookup';
import { useToast } from '@/components/ui/Toast';

import type { ReviewDetailViewProps } from './feedback-detail-types';
import { useFeedbackDetailSelection } from './useFeedbackDetailSelection';
import { useFeedbackDetailComments } from './useFeedbackDetailComments';
import { useFeedbackDetailNavigation } from './useFeedbackDetailNavigation';

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
  onOpenTasks,
  onQuickAssign,
  onToggleTaskComplete,
  onRemoveTask,
  currentMemberId,
  onOpenTaskDetail,
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
  reviewerAvatarUrl,
  reviewerEmail,
  reviewSubmitted = false,
  onReviewSubmitted,
}: ReviewDetailViewProps) {
  const toast = useToast();
  const isAdmin = mode === 'admin';
  const isClient = mode === 'client';

  // Mention-autocomplete data source.
  const participantsUrl =
    isAdmin && project?.id
      ? `/api/campaigns/${project.id}/participants${companyId ? `?company_id=${companyId}` : ''}`
      : isClient && shareToken
      ? `/api/review/${shareToken}/participants${reviewerEmail ? `?exclude_email=${encodeURIComponent(reviewerEmail)}` : ''}`
      : null;

  const [showFinishModal, setShowFinishModal] = useState(false);

  // ── Branding colors (client mode) ──
  const brandingColors = useBrandingColors(branding ?? {} as CompanyBranding);
  const { accent, border, sidebarText, bgSecondary } = brandingColors;

  const hasBranding = !!branding?.logo_url || !!branding?.name;
  const headerBranded = isClient || !!branding?.bg_secondary;

  // ── Feedback hooks ──
  const {
    feedbackMode, pinActive, pendingPin, setPendingPin, imageContainerRef,
    handleImageClick: baseHandleImageClick, handleCancelPin,
    changeFeedbackMode, resetFeedback,
  } = usePinFeedback();

  // Team-member avatar lookup.
  const memberLookup = useTeamMemberLookup(shareToken);

  // ── Selection hook ──
  const selection = useFeedbackDetailSelection({
    items,
    initialItemId,
    initialTypeFilter,
    singleItemOnly,
    versions,
    activeVersionId,
  });

  const {
    selectedItemId, setSelectedItemId,
    typeFilter, setTypeFilter,
    filteredItems, selectedItem, activeVersion,
    activeView, setActiveView,
    currentMockupView, currentIdx, availableTypes,
  } = selection;

  // ── Screenshot capture ──
  const { capture: captureScreenshot } = useScreenshotCapture({
    shareToken,
    itemId: selectedItemId,
  });

  // ── Text highlight state ──
  const commentsLocked = !isAdmin && !!project?.pause_new_comments;
  const { selection: textSelection, clearSelection: clearTextSelection, resetSelection: resetTextSelection } = useTextHighlight({
    containerRef: imageContainerRef as React.RefObject<HTMLElement | null>,
    enabled: !browseMode && !commentsLocked && (feedbackMode === 'idle' || feedbackMode === 'highlight'),
  });

  // ── Comments hook ──
  const commentsState = useFeedbackDetailComments({
    comments,
    selectedItemId,
    selectedItem,
    currentMockupView,
    versions,
    activeVersionId,
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
  });

  const {
    showComments, setShowComments,
    pinHintDismissed, setPinHintDismissed,
    pendingHighlight, setPendingHighlight,
    pendingScreenshotUrl,
    popoverCommentId, setPopoverCommentId,
    highlightedCommentId,
    handleAnnotationComplete, handleSubmitComment,
    handleImageClick, handlePinClick, handlePopoverReply,
    popoverComment,
    annotationComments, highlightComments, commentCountsByView,
    versionScopedComments,
  } = commentsState;

  // ── Comment filtering ──
  const {
    topLevelComments, getReplies,
    unresolvedComments, resolvedComments, pinComments,
  } = useCommentFilters(versionScopedComments, selectedItemId);

  // ── Navigation hook ──
  const { goToItem, handleSidebarSelect, handleFilterChange, reviewedCount } = useFeedbackDetailNavigation({
    items,
    filteredItems,
    comments,
    selectedItemId,
    setSelectedItemId,
    typeFilter,
    setTypeFilter,
    currentIdx,
    resetFeedback,
    onItemChange,
    onFilterChange,
  });

  const isWebpageItem = selectedItem?.type === 'webpage';

  // ── Mobile gate ──
  const MobileGate = (
    <div className="flex lg:hidden min-h-screen items-center justify-center bg-surface p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4 border-2 border-edge-hover">
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
  //  HEADER + DETAIL MODE
  // ══════════════════════════════════════════════════════════════════

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
          reviewerAvatarUrl={reviewerAvatarUrl}
          reviewSubmitted={reviewSubmitted}
          onOpenFinishModal={() => setShowFinishModal(true)}
          hasFinishHandler={onReviewSubmitted !== undefined}
          reviewedCount={isClient ? reviewedCount : undefined}
        />

        {/* Comments-paused banner (client only) */}
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
              onOpenTasks={isAdmin ? onOpenTasks : undefined}
              onQuickAssign={isAdmin ? onQuickAssign : undefined}
              onToggleTaskComplete={isAdmin ? onToggleTaskComplete : undefined}
              onRemoveTask={isAdmin ? onRemoveTask : undefined}
              currentMemberId={isAdmin ? currentMemberId : undefined}
              onOpenTaskDetail={isAdmin ? onOpenTaskDetail : undefined}
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
            <div className={isWebpageItem ? '' : 'min-h-full flex items-center justify-center'}>
              <ItemContentView
                item={selectedItem}
                cursorStyle={
                  browseMode ? 'default'
                    : feedbackMode === 'highlight' ? 'text'
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
                renderWebpage={isClient ? (item) => <WebpageClientPlaceholder item={item} guestName={guestName} guestEmail={reviewerEmail} /> : undefined}
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

            {/* First-time pin hint */}
            {!pinHintDismissed && !browseMode && !commentsLocked && topLevelComments.length === 0 && selectedItem && (
              <button
                type="button"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink/80 text-white text-detail font-medium shadow-lg backdrop-blur-sm animate-[fadeIn_300ms_ease-out] cursor-pointer hover:bg-ink/90 transition-colors"
                onClick={() => {
                  setPinHintDismissed(true);
                  try { localStorage.setItem('feedback-pin-hint-dismissed', '1'); } catch {}
                }}
                aria-label="Dismiss hint"
              >
                <MapPin size={14} className="shrink-0 opacity-80" />
                <span>Click anywhere on the content to pin feedback</span>
              </button>
            )}

            {/* Pin comment popover (existing pins) */}
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
                shareToken={shareToken}
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

            {/* New-highlight popover (anchored at selection) */}
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

      {/* Finish-reviewing modal */}
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
