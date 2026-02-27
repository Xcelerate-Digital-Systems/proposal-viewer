// app/project/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Globe, Mail, Smartphone, ArrowLeft, Monitor } from 'lucide-react';
import { type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { useGuestIdentity } from '@/hooks/useGuestIdentity';
import { useCommentFilters } from '@/hooks/useCommentFilters';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import { CommentsPanel } from '@/components/reviews/comments';
import ItemContentView from '@/components/reviews/ItemContentView';
import TypeFilterTabs from '@/components/reviews/TypeFilterTabs';
import WebpageClientPlaceholder from '@/components/reviews/WebpageClientPlaceholder';
import { FeedbackToolbar, FeedbackModeBar } from '@/components/reviews/feedback';

/**
 * Public project card grid view — /project/[token]
 *
 * Shows the same sidebar + detail layout as the original /review/[token],
 * but is specifically for the "Items List" share mode.
 * Accessed via review_projects.share_token.
 *
 * Supports ?item=<id> for deep-linking to a specific item,
 * and ?back=<url> for showing a back button (e.g. back to whiteboard).
 */
export default function PublicProjectPage({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // URL params
  const urlType = searchParams.get('type');
  const urlItem = searchParams.get('item');
  const backUrl = searchParams.get('back');
  const [typeFilter, setTypeFilter] = useState<string | null>(urlType);

  // Track the URL-specified item to prevent sync effect from overriding it
  const urlItemRef = useRef<string | null>(urlItem);

  // ── Shared hooks ──
  const { guestName, setGuestName, saveGuestIdentity } = useGuestIdentity();
  const { bgSecondary, accent, border, sidebarText } = useBrandingColors(branding);
  const {
    feedbackMode, pendingPin, setPendingPin, imageContainerRef,
    handleImageClick: baseHandleImageClick, handleCancelPin,
    changeFeedbackMode, resetFeedback,
  } = usePinFeedback();
  const {
    topLevelComments, getReplies, unresolvedComments, resolvedComments, pinComments,
  } = useCommentFilters(comments, selectedItemId);

  // ── Derived state ──
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const selectedItem = filteredItems.find((i) => i.id === selectedItemId)
    // Also check full items list in case filter is hiding the URL-specified item
    || items.find((i) => i.id === selectedItemId)
    || null;
  const isWebpageItem = selectedItem?.type === 'webpage';
  const currentIdx = filteredItems.findIndex((i) => i.id === selectedItemId);

  // ── Keep selection in sync with filter — only after initial data load ──
  useEffect(() => {
    if (!dataLoaded) return;
    if (filteredItems.length > 0 && !filteredItems.find((i) => i.id === selectedItemId)) {
      // If we have a URL item that's valid in the full item list (just not in current filter),
      // clear the filter instead of overriding the selection
      if (urlItemRef.current && items.find((i) => i.id === urlItemRef.current)) {
        setTypeFilter(null);
        setSelectedItemId(urlItemRef.current);
      } else {
        setSelectedItemId(filteredItems[0].id);
      }
    }
  }, [filteredItems, selectedItemId, dataLoaded, items]);

  // ── Fetch data via the /api/project/[token] endpoint ──
  useEffect(() => {
    urlItemRef.current = urlItem;
    setLoading(true);
    setDataLoaded(false);

    async function load() {
      try {
        const res = await fetch(`/api/project/${params.token}`, { cache: 'no-store' });
        if (!res.ok) { setNotFound(true); setLoading(false); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);
        setComments(data.comments);

        const targetItem = urlItemRef.current;

        // Select initial item — URL deep-link takes priority
        const startItems = urlType
          ? data.items.filter((i: ReviewItem) => i.type === urlType)
          : data.items;
        if (targetItem && data.items.find((i: ReviewItem) => i.id === targetItem)) {
          setSelectedItemId(targetItem);
        } else if (startItems.length > 0) {
          setSelectedItemId(startItems[0].id);
        } else if (data.items.length > 0) {
          setSelectedItemId(data.items[0].id);
        }

        // Load branding
        const brandRes = await fetch(`/api/company/branding?company_id=${data.project.company_id}`, { cache: 'no-store' });
        if (brandRes.ok) {
          const brandData = await brandRes.json();
          setBranding(brandData);
        }
        setBrandingLoaded(true);
        setLoading(false);
        setDataLoaded(true);
      } catch {
        setNotFound(true);
        setLoading(false);
        setBrandingLoaded(true);
      }
    }
    load();
  }, [params.token, urlItem]);

  // If urlItem changes (e.g. navigating from whiteboard to a different item),
  // update the selection after data is loaded
  useEffect(() => {
    if (!dataLoaded || !urlItem) return;
    urlItemRef.current = urlItem;
    const targetItem = items.find((i) => i.id === urlItem);
    if (targetItem) {
      setSelectedItemId(targetItem.id);
      // Auto-filter to this item's type when coming from whiteboard (no explicit ?type= param)
      if (!urlType) {
        setTypeFilter(targetItem.type);
      }
    }
  }, [urlItem, dataLoaded, items, urlType]);

  // ── Tab title ──
  useEffect(() => {
    if (project) {
      document.title = project.client_name
        ? `Review for ${project.client_name}`
        : project.title;
    }
    return () => { document.title = 'Creative Review'; };
  }, [project]);

  // ── Pin click → also open comments ──
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    baseHandleImageClick(e);
    if (feedbackMode === 'pin') setShowComments(true);
  }, [baseHandleImageClick, feedbackMode]);

  const handlePinClick = useCallback(() => {
    setShowComments(true);
  }, []);

  // ── Submit comment ──
  const submitComment = async (content: string, pinX?: number, pinY?: number, parentId?: string) => {
    if (!selectedItemId || !guestName.trim()) return;
    saveGuestIdentity(guestName);

    const body: Record<string, unknown> = {
      review_item_id: selectedItemId,
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

  // ── Navigate items ──
  const goToItem = (idx: number) => {
    if (idx >= 0 && idx < filteredItems.length) {
      setSelectedItemId(filteredItems[idx].id);
      urlItemRef.current = null;
      resetFeedback();
    }
  };

  // ── Filter change + auto-select first item ──
  const handleFilterChange = (type: string | null) => {
    setTypeFilter(type);
    urlItemRef.current = null;
    if (type) {
      const first = items.find((i) => i.type === type);
      if (first) setSelectedItemId(first.id);
    }
  };

  // ── Back to whiteboard ──
  const handleBack = useCallback(() => {
    if (backUrl) router.push(backUrl);
  }, [backUrl, router]);

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

  return (
    <>
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Mobile — desktop required message */}
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

      {/* Desktop — sidebar + detail layout */}
      <div className="hidden lg:flex min-h-screen flex-row bg-gray-50">
        {/* ── Sidebar ── */}
        <aside
          className="flex flex-col w-[220px] shrink-0 border-r overflow-hidden"
          style={{ backgroundColor: bgSecondary, borderColor: border }}
        >
          <div className="px-4 py-4 border-b" style={{ borderColor: border }}>
            {/* Back to board button */}
            {backUrl && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors hover:opacity-80"
                style={{ color: `${sidebarText}99` }}
              >
                <ArrowLeft size={14} />
                Back to board
              </button>
            )}
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.name} className="h-7 w-auto max-w-[160px] object-contain" />
            ) : branding.name ? (
              <span className="text-sm font-semibold" style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}>
                {branding.name}
              </span>
            ) : null}
            <p className="text-xs mt-1.5 truncate" style={{ color: `${sidebarText}88` }}>
              {project?.title}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto">
            <div className="px-2 pt-2 pb-1">
              <TypeFilterTabs
                items={items}
                availableTypes={availableTypes}
                typeFilter={typeFilter}
                onFilterChange={handleFilterChange}
                variant="branded"
                sidebarTextColor={sidebarText}
              />
            </div>
            <div className="py-1 px-2 space-y-1">
              {filteredItems.map((item) => {
                const isActive = item.id === selectedItemId;
                const itemThreads = comments.filter(
                  (c) => c.review_item_id === item.id && !c.parent_comment_id && !c.resolved
                ).length;
                const thumbUrl = item.image_url || item.screenshot_url || item.ad_creative_url;

                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedItemId(item.id); urlItemRef.current = null; resetFeedback(); }}
                    className="w-full text-left rounded-lg p-2 transition-colors"
                    style={{ backgroundColor: isActive ? `${sidebarText}12` : 'transparent' }}
                  >
                    {item.type === 'webpage' ? (
                      <div className="w-full aspect-video rounded overflow-hidden mb-1.5 flex items-center justify-center"
                        style={{ backgroundColor: `${sidebarText}08` }}>
                        <Globe size={20} style={{ color: `${sidebarText}44` }} />
                      </div>
                    ) : item.type === 'email' ? (
                      <div className="w-full aspect-video rounded overflow-hidden mb-1.5 flex flex-col items-center justify-center gap-1"
                        style={{ backgroundColor: `${sidebarText}08` }}>
                        <Mail size={16} style={{ color: `${sidebarText}44` }} />
                        <span className="text-[9px] truncate max-w-full px-1" style={{ color: `${sidebarText}55` }}>
                          {item.email_subject || 'Email'}
                        </span>
                      </div>
                    ) : item.type === 'sms' ? (
                      <div className="w-full aspect-video rounded overflow-hidden mb-1.5 flex flex-col items-center justify-center gap-1"
                        style={{ backgroundColor: `${sidebarText}08` }}>
                        <Smartphone size={16} style={{ color: `${sidebarText}44` }} />
                        <span className="text-[9px] truncate max-w-full px-1" style={{ color: `${sidebarText}55` }}>
                          {item.sms_body ? `${item.sms_body.slice(0, 20)}…` : 'SMS'}
                        </span>
                      </div>
                    ) : thumbUrl ? (
                      <div className="w-full aspect-video rounded overflow-hidden mb-1.5"
                        style={{ backgroundColor: `${sidebarText}08` }}>
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate"
                        style={{ color: isActive ? sidebarText : `${sidebarText}77`, fontFamily: fontFamily(branding.font_sidebar) }}>
                        {item.title}
                      </span>
                      {itemThreads > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${accent}22`, color: accent }}>
                          {itemThreads}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Desktop nav bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => goToItem(currentIdx - 1)} disabled={currentIdx <= 0}
                className="p-1.5 rounded-lg disabled:opacity-20 transition-opacity text-gray-500">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-gray-600">
                {selectedItem?.title}
                <span className="text-gray-400"> · {currentIdx + 1} of {filteredItems.length}</span>
              </span>
              <button onClick={() => goToItem(currentIdx + 1)} disabled={currentIdx >= filteredItems.length - 1}
                className="p-1.5 rounded-lg disabled:opacity-20 transition-opacity text-gray-500">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Mode bar */}
          <FeedbackModeBar
            mode={feedbackMode}
            onCancel={() => changeFeedbackMode('idle')}
          />

          {/* Item viewer */}
          <div className={`flex-1 relative ${isWebpageItem ? 'overflow-auto' : 'overflow-auto flex items-center justify-center p-8'} bg-gray-50`}>
            <ItemContentView
              item={selectedItem}
              placingPin={feedbackMode === 'pin'}
              pendingPin={pendingPin}
              pinComments={pinComments}
              onImageClick={handleImageClick}
              onPinClick={handlePinClick}
              containerRef={imageContainerRef}
              shareToken={params.token}
              renderWebpage={(item) => <WebpageClientPlaceholder item={item} />}
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
        <CommentsPanel
          unresolvedComments={unresolvedComments}
          resolvedComments={resolvedComments}
          getReplies={getReplies}
          hasComments={topLevelComments.length > 0}
          pendingPin={pendingPin}
          onSubmitComment={submitComment}
          onCancelPin={handleCancelPin}
          onClose={() => setShowComments(false)}
          guestName={guestName}
          onNameChange={setGuestName}
          closable={false}
          className={`${showComments ? 'flex' : 'hidden'} w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white`}
        />
      </div>
    </>
  );
}