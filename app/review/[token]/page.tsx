// app/review/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Image as ImageIcon, ArrowLeft, Monitor } from 'lucide-react';
import { type ReviewProject, type ReviewItem, type ReviewComment, type ReviewBoardEdge, type ReviewBoardNote } from '@/lib/supabase';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { useGuestIdentity } from '@/hooks/useGuestIdentity';
import { isValidHttpUrl } from '@/lib/sanitize';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import ReviewBoardViewer from '@/components/review/ReviewBoardViewer';
import ReviewDetailView from '@/components/reviews/ReviewDetailView';


export default function ReviewViewerPage({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [boardEdges, setBoardEdges] = useState<ReviewBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<ReviewBoardNote[]>([]);
  const [showBoardView, setShowBoardView] = useState(true);
  const [viewMode, setViewMode] = useState<'project' | 'item'>('project');
  const [initialItemId, setInitialItemId] = useState<string | null>(null);
  const [autoTypeFilter, setAutoTypeFilter] = useState<string | null>(null);

  const urlType = searchParams.get('type');
  const urlItem = searchParams.get('item');
  const urlBack = searchParams.get('back');

  // ── Guest identity ──
  const { guestName, setGuestName, saveGuestIdentity } = useGuestIdentity();
  const { setPendingPin } = usePinFeedback();

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

        // If share_mode is board, start in board view — unless deep-linked to an item
        if (data.project.share_mode === 'board' && !urlItem) {
          setShowBoardView(true);
        } else {
          setShowBoardView(false);
        }

        // Select initial item based on URL params
        const startItems = urlType
          ? data.items.filter((i: ReviewItem) => i.type === urlType)
          : data.items;
        if (urlItem && data.items.find((i: ReviewItem) => i.id === urlItem)) {
          setInitialItemId(urlItem);
          // Auto-filter to same type as the deep-linked item
          const linkedItem = data.items.find((i: ReviewItem) => i.id === urlItem);
          if (linkedItem?.type) setAutoTypeFilter(linkedItem.type);
        } else if (startItems.length > 0) {
          setInitialItemId(startItems[0].id);
        } else if (data.items.length > 0) {
          setInitialItemId(data.items[0].id);
        }

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
        ? `Review for ${project.client_name}`
        : project.title;
    }
    return () => { document.title = 'Creative Review'; };
  }, [project]);

  // ── Submit comment via API ──
  const submitComment = async (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string) => {
    if (!guestName.trim()) return;
    saveGuestIdentity(guestName);

    const body: Record<string, unknown> = {
      review_item_id: reviewItemId,
      author_name: guestName.trim(),
      content: content.trim(),
      comment_type: pinX != null ? 'pin' : 'general',
      pin_x: pinX ?? null,
      pin_y: pinY ?? null,
      parent_comment_id: parentId || null,
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

  // ── Board → item detail navigation ──
  const handleBoardItemClick = useCallback((itemId: string) => {
    setInitialItemId(itemId);
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
          <h2 className="text-lg font-semibold text-gray-500">Review not found</h2>
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

        <div className="hidden lg:flex min-h-screen flex-col bg-gray-50">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.name} className="h-6 w-auto max-w-[120px] object-contain" />
              ) : branding.name ? (
                <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: fontFamily(branding.font_heading) }}>
                  {branding.name}
                </span>
              ) : null}
              <span className="text-sm text-gray-400 truncate">
                {project?.title}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Click any item to view details and leave feedback
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <ReviewBoardViewer
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

  // Determine back action: board mode → back to board, ?back= param → external back link
  const backAction = urlBack && isValidHttpUrl(urlBack)
  ? { label: 'Back to Board', onClick: () => { window.location.href = urlBack; } }
  : isBoardMode
    ? { label: 'Back to Board', onClick: () => setShowBoardView(true) }
    : undefined;

  return (
    <ReviewDetailView
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
      shareToken={params.token}
      backAction={backAction}
    />
  );
}