// app/review/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Image as ImageIcon, ArrowLeft, Monitor } from 'lucide-react';
import { type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction, type FeedbackBoardEdge, type FeedbackBoardNote, type FeedbackItemVersion, type FeedbackStatus } from '@/lib/supabase';
import { buildVersionList } from '@/lib/feedback/versions';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import { useGuestIdentity } from '@/hooks/useGuestIdentity';
import { isValidHttpUrl } from '@/lib/sanitize';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import FeedbackBoardViewer from '@/components/feedback/public/FeedbackBoardViewer';
import FeedbackDetailView from '@/components/feedback/FeedbackDetailView';
import GuestOnboardingModal from '@/components/feedback/GuestOnboardingModal';
import ReviewerNoteOverlay from '@/components/feedback/ReviewerNoteOverlay';
import ReviewTopBar, { type ReviewMode } from '@/components/feedback/ReviewTopBar';


export default function ReviewViewerPage({ params }: { params: { token: string } }) {
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
  const [itemVersions, setItemVersions] = useState<FeedbackItemVersion[]>([]);
  /** Per-item override of which version the client is looking at. Missing = use item.active_version_id. */
  const [clientVersionOverrides, setClientVersionOverrides] = useState<Record<string, string | null>>({});
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [showBoardView, setShowBoardView] = useState(true);
  const [viewMode, setViewMode] = useState<'project' | 'item'>('project');
  const [initialItemId, setInitialItemId] = useState<string | null>(null);
  const [autoTypeFilter, setAutoTypeFilter] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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
  const { bgSecondary, sidebarText } = useBrandingColors(branding);

  // Show onboarding modal once storage has been read and no name is stored.
  const showOnboarding = identityHydrated && !guestName && !loading && !notFound;

  // ── Fetch review data ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/review/${params.token}`);
        if (!res.ok) { setNotFound(true); setLoading(false); return; }

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
        if (data.itemVersions) setItemVersions(data.itemVersions);

        // If share_mode is board, start in board view — unless deep-linked to an item
        if (data.project.share_mode === 'board' && !urlItem) {
          setShowBoardView(true);
        } else {
          setShowBoardView(false);
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
  const handleUpdateItemStatus = useCallback(async (itemId: string, status: FeedbackStatus) => {
    const previousStatus = items.find((it) => it.id === itemId)?.status;
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status } : it)));
    const res = await fetch(`/api/review/${params.token}/items/${itemId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok && previousStatus) {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: previousStatus } : it)));
    }
  }, [params.token, items]);

  // ── Submit comment via API ──
  const submitComment = async (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: 'high' | 'medium' | 'low' | 'none', attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => {
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
      comment_type: highlightData ? 'text_highlight' : annotationData ? (annotationData as Record<string, unknown>).type as string : (pinX != null ? 'pin' : 'general'),
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

  // ── Board → item detail navigation ──
  const handleBoardItemClick = useCallback((itemId: string) => {
    setInitialItemId(itemId);
    setSelectedItemId(itemId);
    // Auto-filter to same type as clicked item
    const clickedItem = items.find((i) => i.id === itemId);
    if (clickedItem?.type) setAutoTypeFilter(clickedItem.type);
    setShowBoardView(false);
  }, [items]);

  // ── Early returns ──
  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading review…" />;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={28} className="text-gray-300" />
          </div>
          <h2 className="text-lg font-semibold text-gray-500">Feedback not found</h2>
          <p className="text-sm text-gray-400 mt-1">This link may be expired or invalid</p>
        </div>
      </div>
    );
  }

  const isBoardMode = project?.share_mode === 'board';

  // ══════════════════════════════════════════════════════════════════
  //  BOARD VIEW — genuinely different UI, stays in this route
  // ══════════════════════════════════════════════════════════════════
  if (isBoardMode && showBoardView) {
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
          />
        )}

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

        <div className="hidden lg:flex min-h-screen flex-col bg-gray-50 pt-12">
          <div
            className="px-4 py-2 shrink-0 text-right"
            style={{
              backgroundColor: bgSecondary,
              borderBottom: `1px solid ${sidebarText}15`,
            }}
          >
            <p className="text-xs" style={{ color: `${sidebarText}80` }}>
              Click any item to view details and leave feedback
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <FeedbackBoardViewer
              items={items}
              boardEdges={boardEdges}
              boardNotes={boardNotes}
              comments={comments}
              branding={branding}
              onSelectItem={handleBoardItemClick}
            />
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  DETAIL VIEW — single item or sidebar+detail, delegated to shared
  // ══════════════════════════════════════════════════════════════════

  // Determine back action: ?back= absolute URL OR same-origin path, else
  // board-mode fallback. Relative paths (e.g. /whiteboard/xxx when the item
  // link comes from a shared whiteboard) are also accepted — they just need
  // to start with a single slash to avoid protocol-relative URLs.
  const isSafeBackPath = urlBack != null && urlBack.startsWith('/') && !urlBack.startsWith('//');
  const backAction = urlBack && (isValidHttpUrl(urlBack) || isSafeBackPath)
    ? { label: 'Back to Board', onClick: () => { window.location.href = urlBack; } }
    : isBoardMode
      ? { label: 'Back to Board', onClick: () => setShowBoardView(true) }
      : undefined;

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
      {!showOnboarding && project && (
        <ReviewTopBar
          projectTitle={project.title}
          clientName={project.client_name}
          shareToken={params.token}
          reviewerName={guestName}
          reviewerEmail={guestEmail}
          mode={reviewMode}
          onModeChange={setReviewMode}
          accentColor={branding.accent_color}
          logoUrl={branding.logo_url}
          companyName={branding.name}
          fontHeading={branding.font_heading}
          submitted={reviewSubmitted}
          onSubmitted={() => setReviewSubmitted(true)}
        />
      )}
      <div className="pt-12 min-h-screen flex flex-col">
        <FeedbackDetailView
          mode="client"
          project={project!}
          items={items}
          comments={comments}
          initialItemId={initialItemId}
          initialTypeFilter={urlType || autoTypeFilter}
          singleItemOnly={viewMode === 'item'}
          hideFilterBar={!!autoTypeFilter}
          guestName={guestName}
          onGuestNameChange={setGuestName}
          onSubmitComment={submitComment}
          onItemChange={handleItemChange}
          shareToken={params.token}
          companyId={project?.company_id}
          browseMode={reviewMode === 'browse'}
          versions={selectedItem && selectedItem.type !== 'webpage' ? selectedItemVersions : undefined}
          activeVersionId={resolvedActiveVersionId}
          onVersionChange={selectedItem && selectedItem.type !== 'webpage' ? handleClientVersionChange : undefined}
          backAction={backAction}
          onUpdateItemStatus={handleUpdateItemStatus}
        />
      </div>
    </>
  );
}