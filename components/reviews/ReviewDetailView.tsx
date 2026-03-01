// components/reviews/ReviewDetailView.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Monitor,
} from 'lucide-react';
import type { ReviewProject, ReviewItem, ReviewComment } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import { useCommentFilters } from '@/hooks/useCommentFilters';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { CommentsPanel } from '@/components/reviews/comments';
import ItemContentView from '@/components/reviews/ItemContentView';
import ItemSidebar from '@/components/reviews/ItemSidebar';
import WebpageClientPlaceholder from '@/components/reviews/WebpageClientPlaceholder';
import { FeedbackToolbar, FeedbackModeBar } from '@/components/reviews/feedback';

/* ─── Types ──────────────────────────────────────────────────────── */

interface ReviewDetailViewProps {
  /** 'admin' = authenticated team member, 'client' = public token-based */
  mode: 'admin' | 'client';

  // ── Data ──
  project: ReviewProject;
  items: ReviewItem[];
  comments: ReviewComment[];
  /** All project comments for sidebar badge counts (admin only — lightweight shape) */
  allProjectComments?: Pick<ReviewComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[];

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
  /** Submit a new comment. Called with (reviewItemId, content, pinX?, pinY?, parentId?) */
  onSubmitComment: (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string) => Promise<void>;
  /** Resolve a comment (admin only) */
  onResolveComment?: (commentId: string) => Promise<void>;
  /** Unresolve a comment (admin only) */
  onUnresolveComment?: (commentId: string) => Promise<void>;
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
  renderHeaderActions?: (currentItem: ReviewItem | null) => React.ReactNode;

  // ── Comments updated externally (e.g. after submit in parent) ──
  /** Updated comments array — when parent manages comment state */
  onCommentsUpdate?: (comments: ReviewComment[]) => void;
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function ReviewDetailView({
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
  onItemChange,
  onFilterChange,
  backAction,
  shareToken,
  renderHeaderActions,
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
  const { bgSecondary, accent, border, sidebarText } = brandingColors;

  // Use admin-style sidebar when no branding is provided (unbranded client mode)
  const hasBranding = isClient && branding?.logo_url || branding?.name;

  // ── Feedback hooks ──
  const {
    feedbackMode, pendingPin, setPendingPin, imageContainerRef,
    handleImageClick: baseHandleImageClick, handleCancelPin,
    changeFeedbackMode, resetFeedback,
  } = usePinFeedback();

  // ── Derived data ──
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const selectedItem = useMemo(() => {
    return filteredItems.find((i) => i.id === selectedItemId)
      || items.find((i) => i.id === selectedItemId)
      || null;
  }, [filteredItems, items, selectedItemId]);

  const handleSubmitComment = useCallback(
    async (content: string, pinX?: number, pinY?: number, parentId?: string) => {
      if (!selectedItemId) return;
      await onSubmitComment(selectedItemId, content, pinX, pinY, parentId);
    },
    [selectedItemId, onSubmitComment]
  );

  const currentIdx = filteredItems.findIndex((i) => i.id === selectedItemId);
  const isWebpageItem = selectedItem?.type === 'webpage';

  // ── Comment filtering ──
  const {
    topLevelComments, getReplies,
    unresolvedComments, resolvedComments, pinComments,
  } = useCommentFilters(comments, selectedItemId);

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

  // ── Pin click → also open comments ──
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    baseHandleImageClick(e);
    if (feedbackMode === 'pin') setShowComments(true);
  }, [baseHandleImageClick, feedbackMode]);

  const handlePinClick = useCallback(() => {
    setShowComments(true);
  }, []);

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
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Monitor size={24} className="text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-700">Desktop Required</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Please open this review on a desktop browser for the best experience.
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
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
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
              <span className="text-sm text-gray-600 truncate">{selectedItem.title}</span>
            </div>
            {renderHeaderActions?.(selectedItem)}
          </div>

          <FeedbackModeBar mode={feedbackMode} onCancel={() => changeFeedbackMode('idle')} />

          <div className="flex-1 flex min-h-0">
            <div className={`flex-1 relative ${isWebpageItem ? 'overflow-auto' : 'overflow-auto flex items-center justify-center p-8'} bg-gray-50`}>
              <ItemContentView
                item={selectedItem}
                placingPin={feedbackMode === 'pin'}
                pendingPin={pendingPin}
                pinComments={pinComments}
                onImageClick={handleImageClick}
                onPinClick={handlePinClick}
                containerRef={imageContainerRef}
                shareToken={shareToken || ''}
                renderWebpage={isClient ? (item) => <WebpageClientPlaceholder item={item} /> : undefined}
              />

              <FeedbackToolbar
                mode={feedbackMode}
                onModeChange={changeFeedbackMode}
                onToggleComments={() => setShowComments(!showComments)}
                commentsOpen={showComments}
                unresolvedCount={unresolvedComments.length}
                hidePinTool={isWebpageItem}
                className="absolute top-4 right-4"
              />
            </div>

            <CommentsPanel
              unresolvedComments={unresolvedComments}
              resolvedComments={resolvedComments}
              getReplies={getReplies}
              hasComments={topLevelComments.length > 0}
              pendingPin={pendingPin}
              onSubmitComment={handleSubmitComment}
              onCancelPin={handleCancelPin}
              onClose={() => setShowComments(false)}
              authorName={isAdmin ? authorName : undefined}
              guestName={isClient ? guestName : undefined}
              onNameChange={isClient ? onGuestNameChange : undefined}
              onResolve={onResolveComment}
              onUnresolve={onUnresolveComment}
              closable={false}
              className={`${showComments ? 'flex' : 'hidden'} w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white`}
            />
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  SIDEBAR + DETAIL MODE (default)
  // ══════════════════════════════════════════════════════════════════

  // Determine which types to show in sidebar filter — hide when hideFilterBar is set
  const sidebarTypes = hideFilterBar ? [] : (isAdmin && typeFilter ? [] : availableTypes);

  const sidebarVariant = isAdmin || !hasBranding ? 'admin' : 'branded';

  return (
    <>
      {isClient && branding && (
        <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />
      )}

      {MobileGate}

      <div className={`hidden lg:flex ${isAdmin ? 'h-full' : 'h-screen overflow-hidden'} flex-row bg-gray-50`}>
        {/* ── Sidebar ── */}
        <ItemSidebar
          items={items}
          filteredItems={filteredItems}
          availableTypes={sidebarTypes}
          typeFilter={typeFilter}
          onFilterChange={handleFilterChange}
          selectedItemId={selectedItemId}
          onSelectItem={handleSidebarSelect}
          comments={isAdmin ? allProjectComments : comments as Pick<ReviewComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[]}
          variant={sidebarVariant as 'admin' | 'branded'}
          projectTitle={project.title}
          logoUrl={hasBranding ? branding?.logo_url : undefined}
          companyName={hasBranding ? branding?.name : undefined}
          bgColor={hasBranding ? bgSecondary : undefined}
          borderColor={hasBranding ? border : undefined}
          textColor={hasBranding ? sidebarText : undefined}
          accentColor={hasBranding ? accent : undefined}
          fontHeading={hasBranding && branding ? fontFamily(branding.font_heading) : undefined}
          fontSidebar={hasBranding && branding ? fontFamily(branding.font_sidebar) : undefined}
        />

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
            {/* Left — back action */}
            <div className="flex items-center min-w-[180px]">
              {backAction && (
                <button
                  onClick={backAction.onClick}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft size={14} />
                  {backAction.label}
                </button>
              )}
            </div>

            {/* Center — item nav */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => goToItem(currentIdx - 1)}
                disabled={currentIdx <= 0}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft size={20} strokeWidth={2} />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-medium text-gray-800 truncate max-w-[280px]">
                  {selectedItem?.title}
                </span>
                <span className="text-[11px] text-gray-400">
                  {currentIdx + 1} of {filteredItems.length}
                </span>
              </div>
              <button
                onClick={() => goToItem(currentIdx + 1)}
                disabled={currentIdx >= filteredItems.length - 1}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight size={20} strokeWidth={2} />
              </button>
            </div>

            {/* Right — actions */}
            <div className="flex items-center gap-2 min-w-[180px] justify-end">
              {renderHeaderActions?.(selectedItem)}
            </div>
          </div>

          {/* Mode bar — appears when pin mode is active */}
          <FeedbackModeBar
            mode={feedbackMode}
            onCancel={() => changeFeedbackMode('idle')}
          />

          {/* Item viewer */}
          <div
            className={`flex-1 relative ${
              isWebpageItem ? 'overflow-auto' : 'overflow-auto flex items-center justify-center p-6'
            } bg-gray-50`}
          >
            <ItemContentView
              item={selectedItem}
              placingPin={feedbackMode === 'pin'}
              pendingPin={pendingPin}
              pinComments={pinComments}
              onImageClick={handleImageClick}
              onPinClick={handlePinClick}
              containerRef={imageContainerRef}
              shareToken={shareToken || ''}
              renderWebpage={isClient ? (item) => <WebpageClientPlaceholder item={item} /> : undefined}
              emptyText="No items to review"
            />

            <FeedbackToolbar
              mode={feedbackMode}
              onModeChange={changeFeedbackMode}
              onToggleComments={() => setShowComments(!showComments)}
              commentsOpen={showComments}
              unresolvedCount={unresolvedComments.length}
              hidePinTool={isWebpageItem}
              className="absolute top-4 right-4"
            />
          </div>
        </div>

        {/* ── Comments panel ── */}
        {showComments && (
          <CommentsPanel
            unresolvedComments={unresolvedComments}
            resolvedComments={resolvedComments}
            getReplies={getReplies}
            hasComments={topLevelComments.length > 0}
            pendingPin={pendingPin}
            onSubmitComment={handleSubmitComment}
            onCancelPin={handleCancelPin}
            onClose={() => setShowComments(false)}
            authorName={isAdmin ? authorName : undefined}
            guestName={isClient ? guestName : undefined}
            onNameChange={isClient ? onGuestNameChange : undefined}
            onResolve={onResolveComment}
            onUnresolve={onUnresolveComment}
            className="w-[340px] shrink-0 border-l border-gray-200 bg-white flex flex-col"
          />
        )}
      </div>
    </>
  );
}