// app/review/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Image as ImageIcon, Monitor } from 'lucide-react';
import { type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction, type FeedbackBoardEdge, type FeedbackBoardNote, type FeedbackBoardShape, type FeedbackItemVersion, type FeedbackStatus } from '@/lib/supabase';
import { DEFAULT_SHARED_VIEWS, type FeedbackSharedViews } from '@/lib/types/feedback';
import { buildVersionList } from '@/lib/feedback/versions';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import { useGuestIdentity } from '@/hooks/useGuestIdentity';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import FeedbackBoardViewer from '@/components/feedback/public/FeedbackBoardViewer';
import PublicKanbanView from '@/components/feedback/public/PublicKanbanView';
import PublicItemsGrid from '@/components/feedback/public/PublicItemsGrid';
import PublicTabBar, { type PublicTab } from '@/components/feedback/public/PublicTabBar';
import FeedbackDetailView from '@/components/feedback/FeedbackDetailView';
import GuestOnboardingModal from '@/components/feedback/GuestOnboardingModal';
import ReviewerNoteOverlay from '@/components/feedback/ReviewerNoteOverlay';
import ReviewTopBar, { type ReviewMode } from '@/components/feedback/ReviewTopBar';


export default function ReviewViewerPage(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const searchParams = useSearchParams();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [boardEdges, setBoardEdges] = useState<FeedbackBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FeedbackBoardNote[]>([]);
  const [boardShapes, setBoardShapes] = useState<FeedbackBoardShape[]>([]);
  const [itemVersions, setItemVersions] = useState<FeedbackItemVersion[]>([]);
  /** Per-item override of which version the client is looking at. Missing = use item.active_version_id. */
  const [clientVersionOverrides, setClientVersionOverrides] = useState<Record<string, string | null>>({});
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [currentTab, setCurrentTab] = useState<PublicTab>('items');
  const [viewMode, setViewMode] = useState<'project' | 'item'>('project');
  const [initialItemId, setInitialItemId] = useState<string | null>(null);
  const [autoTypeFilter, setAutoTypeFilter] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  /** When set, replace whichever tab the user is on with the single-item
   *  detail view. Null returns to the tab's default content (grid / board /
   *  kanban). Drives the back-button affordance and hides the tab strip. */
  const [inlineItemId, setInlineItemId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('comment');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('av-review-complete-' + params.token)) {
      setReviewSubmitted(true);
    }
  }, [params.token]);

  const urlType = searchParams.get('type');
  const urlItem = searchParams.get('item');
  const urlBack = searchParams.get('back');

  // ── Guest identity ──
  const { guestName, guestEmail, setGuestName, saveGuestIdentity, hydrated: identityHydrated } = useGuestIdentity();
  const { setPendingPin } = usePinFeedback();
  const { bgSecondary, sidebarText, palette } = useBrandingColors(branding);

  // Show onboarding modal once storage has been read and no name is stored.
  const showOnboarding = identityHydrated && !guestName && !loading && !notFound;

  // ── Fetch review data ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/review/${params.token}`);
        if (!res.ok) { setNotFound(true); setLoading(false); setBrandingLoaded(true); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);
        setComments(data.comments);

        // Set resolution mode
        if (data.mode === 'item') {
          setViewMode('item');
          if (data.item) setInitialItemId(data.item.id);
        }

        // Board data
        if (data.boardEdges) setBoardEdges(data.boardEdges);
        if (data.boardNotes) setBoardNotes(data.boardNotes);
        if (data.boardShapes) setBoardShapes(data.boardShapes);
        if (data.itemVersions) setItemVersions(data.itemVersions);

        // Pick the initial tab based on shared_views + url params. Deep
        // links to a specific item always land on the items tab so the
        // detail view renders straight away.
        const sharedViews: FeedbackSharedViews =
          (data.project.shared_views as FeedbackSharedViews | null) ?? DEFAULT_SHARED_VIEWS;
        if (urlItem) {
          setCurrentTab('items');
        } else if (data.project.share_mode === 'board' && sharedViews.board) {
          setCurrentTab('board');
        } else if (sharedViews.board) {
          setCurrentTab('board');
        } else if (sharedViews.kanban) {
          setCurrentTab('kanban');
        } else {
          setCurrentTab('items');
        }

        // Select initial item based on URL params
        const startItems = urlType
          ? data.items.filter((i: FeedbackItem) => i.type === urlType)
          : data.items;
        let startId: string | null = null;
        if (urlItem && data.items.find((i: FeedbackItem) => i.id === urlItem)) {
          startId = urlItem;
          const linkedItem = data.items.find((i: FeedbackItem) => i.id === urlItem);
          if (linkedItem?.type) setAutoTypeFilter(linkedItem.type);
        } else if (startItems.length > 0) {
          startId = startItems[0].id;
        } else if (data.items.length > 0) {
          startId = data.items[0].id;
        }
        setInitialItemId(startId);
        setSelectedItemId(startId);
        // Deep links (?item=…) and per-item share tokens drop straight into
        // the inline detail view so reviewers don't see the grid first.
        if (urlItem || data.mode === 'item') setInlineItemId(startId);

        // Load branding
        const brandRes = await fetch(`/api/company/branding?company_id=${data.project.company_id}`);
        if (brandRes.ok) {
          const brandData = await brandRes.json();
          setBranding(brandData);
        }
        setBrandingLoaded(true);
        setLoading(false);
      } catch {
        setNotFound(true);
        setLoading(false);
        setBrandingLoaded(true);
      }
    }
    load();
  }, [params.token]);

  // ── Tab title ──
  useEffect(() => {
    if (project) {
      document.title = project.client_name
        ? `Feedback for ${project.client_name}`
        : project.title;
    }
    return () => { document.title = 'Feedback'; };
  }, [project]);

  // ── Version selection for the currently-selected item ──
  const selectedItem = items.find((i) => i.id === selectedItemId) || null;
  const selectedItemVersions = selectedItem
    ? buildVersionList(selectedItem, itemVersions.filter((v) => v.review_item_id === selectedItem.id))
    : [];
  const resolvedActiveVersionId = selectedItem
    ? (clientVersionOverrides[selectedItem.id] !== undefined
        ? clientVersionOverrides[selectedItem.id]
        : selectedItem.active_version_id ?? null)
    : null;

  const handleClientVersionChange = useCallback((versionId: string | null) => {
    if (!selectedItemId) return;
    setClientVersionOverrides((prev) => ({ ...prev, [selectedItemId]: versionId }));
  }, [selectedItemId]);

  const handleItemChange = useCallback((id: string) => {
    setSelectedItemId(id);
  }, []);

  // Client status change — hits the token-scoped status endpoint and
  // optimistically patches the local items list so the header updates.
  // Reviewer identity is passed along so the per-reviewer decision log
  // (Filestage's "N of M approved") can attribute the vote.
  const handleUpdateItemStatus = useCallback(async (itemId: string, status: FeedbackStatus) => {
    const previousStatus = items.find((it) => it.id === itemId)?.status;
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status } : it)));
    const res = await fetch(`/api/review/${params.token}/items/${itemId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        reviewer_email: guestEmail.trim() || null,
        reviewer_name: guestName.trim() || null,
      }),
    });
    if (!res.ok && previousStatus) {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: previousStatus } : it)));
    }
  }, [params.token, items, guestEmail, guestName]);

  // ── Submit comment via API ──
  const submitComment = async (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: 'high' | 'medium' | 'normal' | 'low' | 'none', attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => {
    if (!guestName.trim()) return;
    saveGuestIdentity(guestName, guestEmail);

    // Stamp with whichever version the client is currently looking at. Replies
    // inherit the parent's version so threads stay anchored to one render.
    const parent = parentId ? comments.find((c) => c.id === parentId) : null;
    const versionIdForComment = parent
      ? (parent.version_id ?? null)
      : (reviewItemId === selectedItemId ? resolvedActiveVersionId : null);

    const body: Record<string, unknown> = {
      review_item_id: reviewItemId,
      author_name: guestName.trim(),
      author_email: guestEmail.trim() || null,
      content: content.trim(),
      comment_type: highlightData
        ? 'text_highlight'
        : (annotationData && typeof (annotationData as Record<string, unknown>).type === 'string')
          ? (annotationData as Record<string, unknown>).type as string
          : (pinX != null ? 'pin' : 'general'),
      pin_x: pinX ?? null,
      pin_y: pinY ?? null,
      parent_comment_id: parentId || null,
      annotation_data: annotationData || null,
      screenshot_url: screenshotUrl || null,
      highlight_start: highlightData?.start ?? null,
      highlight_end: highlightData?.end ?? null,
      highlight_text: highlightData?.text ?? null,
      highlight_element_path: highlightData?.elementPath ?? null,
      priority: priority ?? 'none',
      attachments: attachments || [],
      video_url: videoUrl ?? null,
      version_id: versionIdForComment,
    };

    const res = await fetch(`/api/review/${params.token}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setPendingPin(null);
    }
  };

  // ── Edit / delete own comment ──
  const editComment = useCallback(async (commentId: string, content: string) => {
    const res = await fetch(`/api/review/${params.token}/comments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment_id: commentId,
        content,
        author_email: guestEmail.trim() || null,
        author_name: guestName.trim() || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
    }
  }, [params.token, guestEmail, guestName]);

  const deleteComment = useCallback(async (commentId: string) => {
    const qs = new URLSearchParams({ comment_id: commentId });
    if (guestEmail.trim()) qs.set('author_email', guestEmail.trim());
    if (guestName.trim()) qs.set('author_name', guestName.trim());
    const res = await fetch(`/api/review/${params.token}/comments?${qs.toString()}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId)
      );
    }
  }, [params.token, guestEmail, guestName]);

  // ── Toggle reaction ──
  const toggleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!guestName.trim()) return;
    const res = await fetch(`/api/review-comments/${commentId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, author_name: guestName.trim() }),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.action === 'added') {
        setReactions((prev) => [...prev, result.reaction]);
      } else {
        setReactions((prev) => prev.filter((r) => r.id !== result.id));
      }
    }
  }, [guestName]);

  // ── Item card → inline detail view ──
  // Renders the item detail in place of the current tab content (board /
  // kanban / items grid) instead of jumping to a different tab. Webpage
  // items still open externally so reviewers can see the live page.
  const handleBoardItemClick = useCallback((itemId: string) => {
    const clickedItem = items.find((i) => i.id === itemId);
    if (clickedItem?.type === 'webpage' && clickedItem.url) {
      try {
        const url = new URL(clickedItem.url);
        if (guestName.trim()) {
          url.searchParams.set('aviz_name', guestName.trim());
          if (guestEmail.trim()) url.searchParams.set('aviz_email', guestEmail.trim());
        }
        window.open(url.toString(), '_blank');
      } catch {
        window.open(clickedItem.url, '_blank');
      }
      return;
    }
    setInitialItemId(itemId);
    setSelectedItemId(itemId);
    if (clickedItem?.type) setAutoTypeFilter(clickedItem.type);
    setInlineItemId(itemId);
  }, [items]);

  // Resolve which tabs the project share link exposes.
  const sharedViews: FeedbackSharedViews = useMemo(
    () => (project?.shared_views as FeedbackSharedViews | null) ?? DEFAULT_SHARED_VIEWS,
    [project?.shared_views]
  );

  // ── Early returns ──
  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: 'transparent' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading review…" />;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={28} className="text-faint" />
          </div>
          <h2 className="text-lg font-semibold text-dim">Feedback not found</h2>
          <p className="text-sm text-faint mt-1">This link may be expired or invalid</p>
        </div>
      </div>
    );
  }

  const isSingleItem = viewMode === 'item';
  const enabledTabCount =
    (sharedViews.board ? 1 : 0) + (sharedViews.kanban ? 1 : 0) + (sharedViews.items ? 1 : 0);

  // ══════════════════════════════════════════════════════════════════
  //  EMPTY-SHARE STATE — no tabs are exposed
  // ══════════════════════════════════════════════════════════════════
  if (!isSingleItem && enabledTabCount === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-dim">Nothing shared yet</h2>
          <p className="text-sm text-faint mt-1">The project owner hasn&apos;t enabled any shared views.</p>
        </div>
      </div>
    );
  }

  // The detail view is shown for per-item shares (token resolved to an
  // item) AND for inline drill-downs from the grid / board / kanban.
  const isShowingDetail = isSingleItem || !!inlineItemId;

  // Back action: explicit ?back= URL wins. Otherwise inline drill-downs
  // close back to the active tab. Per-item-token shares have no fallback.
  // Only allow relative paths for ?back= — absolute URLs are an open redirect risk
  const isSafeBackPath = urlBack != null && urlBack.startsWith('/') && !urlBack.startsWith('//');
  const backAction = isSafeBackPath
    ? { label: 'Back', onClick: () => { window.location.href = urlBack; } }
    : (inlineItemId && !isSingleItem)
      ? { label: 'Back', onClick: () => setInlineItemId(null) }
      : undefined;

  // ══════════════════════════════════════════════════════════════════
  //  SINGLE-ITEM DETAIL — item-token shares OR inline drill-down
  //  FeedbackDetailView ships its own header + back button, so we skip
  //  the project-level ReviewTopBar / tab strip in this state.
  // ══════════════════════════════════════════════════════════════════
  if (isShowingDetail) {
    return (
      <>
        <GuestOnboardingModal
          open={showOnboarding}
          onSubmit={(name, email) => saveGuestIdentity(name, email)}
          accentColor={branding.accent_color}
          logoUrl={branding.logo_url}
          companyName={branding.name}
          projectTitle={project?.title}
          fontHeading={branding.font_heading}
        />
        {!showOnboarding && project?.reviewer_note_show && project?.reviewer_note && (
          <ReviewerNoteOverlay
            shareToken={params.token}
            note={project.reviewer_note}
            updatedAt={project.reviewer_note_updated_at}
            accentColor={branding.accent_color}
            logoUrl={branding.logo_url}
            companyName={branding.name}
            fontHeading={branding.font_heading}
          />
        )}
        <div className="min-h-screen flex flex-col">
          <FeedbackDetailView
            mode="client"
            project={project!}
            items={items}
            comments={comments}
            branding={branding}
            initialItemId={inlineItemId ?? initialItemId}
            initialTypeFilter={urlType || autoTypeFilter}
            singleItemOnly
            hideFilterBar={!!autoTypeFilter}
            guestName={guestName}
            onGuestNameChange={setGuestName}
            onSubmitComment={submitComment}
            onEditComment={editComment}
            onDeleteComment={deleteComment}
            onItemChange={handleItemChange}
            shareToken={params.token}
            companyId={project?.company_id}
            browseMode={reviewMode === 'browse'}
            versions={selectedItem && selectedItem.type !== 'webpage' ? selectedItemVersions : undefined}
            activeVersionId={resolvedActiveVersionId}
            onVersionChange={selectedItem && selectedItem.type !== 'webpage' ? handleClientVersionChange : undefined}
            backAction={backAction}
            onUpdateItemStatus={handleUpdateItemStatus}
            reviewMode={reviewMode}
            onReviewModeChange={setReviewMode}
            reviewerName={guestName}
            reviewerEmail={guestEmail}
            reviewSubmitted={reviewSubmitted}
            onReviewSubmitted={() => setReviewSubmitted(true)}
          />
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  TAB VIEWS — Board / Kanban / Items grid share one branded shell
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />
      <GuestOnboardingModal
        open={showOnboarding}
        onSubmit={(name, email) => saveGuestIdentity(name, email)}
        accentColor={branding.accent_color}
        logoUrl={branding.logo_url}
        companyName={branding.name}
        projectTitle={project?.title}
        fontHeading={branding.font_heading}
      />
      {!showOnboarding && project?.reviewer_note_show && project?.reviewer_note && (
        <ReviewerNoteOverlay
          shareToken={params.token}
          note={project.reviewer_note}
          updatedAt={project.reviewer_note_updated_at}
          accentColor={branding.accent_color}
          logoUrl={branding.logo_url}
          companyName={branding.name}
          fontHeading={branding.font_heading}
        />
      )}
      {!showOnboarding && project && (
        <ReviewTopBar
          projectTitle={project.title}
          clientName={project.client_name}
          projectStatus={project.status}
          commentsPaused={project.pause_new_comments}
          shareToken={params.token}
          reviewerName={guestName}
          reviewerEmail={guestEmail}
          mode={reviewMode}
          onModeChange={setReviewMode}
          accentColor={branding.accent_color}
          logoUrl={branding.logo_url}
          companyName={branding.name}
          fontHeading={branding.font_heading}
          branding={branding}
          submitted={reviewSubmitted}
          onSubmitted={() => setReviewSubmitted(true)}
          items={items}
        />
      )}

      {currentTab !== 'items' && (
        <div className="flex lg:hidden min-h-screen items-center justify-center bg-surface p-6">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
              <Monitor size={24} className="text-faint" />
            </div>
            <h2 className="text-base font-semibold text-prose">Desktop Required</h2>
            <p className="text-sm text-dim mt-2 leading-relaxed">
              Please open this review on a desktop browser for the best experience.
            </p>
          </div>
        </div>
      )}

      <div
        className={`${
          currentTab === 'items' ? 'flex' : 'hidden lg:flex'
        } h-dvh flex-col bg-surface pt-12 overflow-hidden`}
      >
        <PublicTabBar
          current={currentTab}
          views={sharedViews}
          onChange={setCurrentTab}
          bgSecondary={bgSecondary}
          sidebarText={sidebarText}
          palette={palette}
        />

        {currentTab === 'board' && (
          <>
            <div
              className="px-4 py-2 shrink-0 text-right"
              style={{
                backgroundColor: bgSecondary,
                borderBottom: `1px solid ${palette.borderSubtle}`,
              }}
            >
              <p className="text-xs" style={{ color: palette.mutedText }}>
                Click any item to view details and leave feedback
              </p>
            </div>
            <div className="flex-1 min-h-0">
              <FeedbackBoardViewer
                items={items}
                boardEdges={boardEdges}
                boardNotes={boardNotes}
                boardShapes={boardShapes}
                comments={comments}
                branding={branding}
                onSelectItem={handleBoardItemClick}
              />
            </div>
          </>
        )}

        {currentTab === 'kanban' && (
          <div className="flex-1 min-h-0">
            <PublicKanbanView
              items={items}
              comments={comments}
              branding={branding}
              onSelectItem={handleBoardItemClick}
              onUpdateStatus={handleUpdateItemStatus}
            />
          </div>
        )}

        {currentTab === 'items' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PublicItemsGrid
              items={items}
              comments={comments}
              initialTypeFilter={urlType || autoTypeFilter}
              onSelectItem={handleBoardItemClick}
            />
          </div>
        )}
      </div>
    </>
  );
}