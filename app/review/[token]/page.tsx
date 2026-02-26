// app/review/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare, ChevronLeft, ChevronRight, Menu, X, Image as ImageIcon, MapPin, Globe, ExternalLink, Mail, Smartphone } from 'lucide-react';
import { type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import { type CompanyBranding, deriveBorderColor } from '@/hooks/useProposal';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import { CommentsPanel } from '@/components/reviews/comments';
import ItemContentView from '@/components/reviews/ItemContentView';
import TypeFilterTabs from '@/components/reviews/TypeFilterTabs';

const DEFAULT_BRANDING: CompanyBranding = {
  name: '', logo_url: null, accent_color: '#ff6700', website: null,
  bg_primary: '#0f0f0f', bg_secondary: '#141414',
  sidebar_text_color: '#ffffff', accept_text_color: '#ffffff',
  cover_bg_style: 'gradient', cover_bg_color_1: '#0f0f0f', cover_bg_color_2: '#141414',
  cover_text_color: '#ffffff', cover_subtitle_color: '#ffffffb3',
  cover_button_bg: '#ff6700', cover_button_text: '#ffffff',
  cover_overlay_opacity: 0.65, cover_gradient_type: 'linear', cover_gradient_angle: 135,
  font_heading: null, font_body: null, font_sidebar: null,
  font_heading_weight: null, font_body_weight: null, font_sidebar_weight: null,
  text_page_bg_color: '#141414', text_page_text_color: '#ffffff',
  text_page_heading_color: null, text_page_font_size: '14',
  text_page_border_enabled: true, text_page_border_color: null,
  text_page_border_radius: '12', text_page_layout: 'contained',
};

const GUEST_STORAGE_KEY = 'review_guest_identity';

export default function ReviewViewerPage({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Guest identity
  const [guestName, setGuestName] = useState('');

  // Pin placement mode (image/ad items only — webpage pins come via the widget)
  const [placingPin, setPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Type filter — from URL or user interaction
  const urlType = searchParams.get('type');
  const urlItem = searchParams.get('item');
  const [typeFilter, setTypeFilter] = useState<string | null>(urlType);

  // Unique types present in items (for filter tabs)
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  // Keep selection in sync with filter
  useEffect(() => {
    if (filteredItems.length > 0 && !filteredItems.find((i) => i.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  // Load guest identity from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const { name } = JSON.parse(stored);
        if (name) setGuestName(name);
      }
    } catch {}
  }, []);

  // Save guest identity
  const saveGuestIdentity = useCallback((name: string) => {
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ name }));
    } catch {}
  }, []);

  // Fetch review data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/review/${params.token}`);
        if (!res.ok) { setNotFound(true); setLoading(false); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);
        setComments(data.comments);

        // Select initial item based on URL params
        const startItems = urlType
          ? data.items.filter((i: ReviewItem) => i.type === urlType)
          : data.items;
        if (urlItem && data.items.find((i: ReviewItem) => i.id === urlItem)) {
          setSelectedItemId(urlItem);
        } else if (startItems.length > 0) {
          setSelectedItemId(startItems[0].id);
        } else if (data.items.length > 0) {
          setSelectedItemId(data.items[0].id);
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

  // Update tab title
  useEffect(() => {
    if (project) {
      document.title = project.client_name
        ? `Review for ${project.client_name}`
        : project.title;
    }
    return () => { document.title = 'Creative Review'; };
  }, [project]);

  const selectedItem = filteredItems.find((i) => i.id === selectedItemId) || null;
  const isWebpageItem = selectedItem?.type === 'webpage';
  const itemComments = comments.filter((c) => c.review_item_id === selectedItemId);
  const topLevelComments = itemComments.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId: string) => itemComments.filter((c) => c.parent_comment_id === parentId);
  const unresolvedComments = topLevelComments.filter((c) => !c.resolved);
  const resolvedComments = topLevelComments.filter((c) => c.resolved);

  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';

  // ── Pin click handler — image/ad items ──
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setPlacingPin(false);
    setShowComments(true);
  };

  // ── Pin click handler ──
  const handlePinClick = useCallback(() => {
    setShowComments(true);
  }, []);

  // ── Cancel pin ──
  const handleCancelPin = useCallback(() => {
    setPendingPin(null);
  }, []);

  // ── Submit comment (image/ad items — general comments from panel) ──
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
  const currentIdx = filteredItems.findIndex((i) => i.id === selectedItemId);
  const goToItem = (idx: number) => {
    if (idx >= 0 && idx < filteredItems.length) {
      setSelectedItemId(filteredItems[idx].id);
      setPendingPin(null);
      setPlacingPin(false);
    }
  };

  // ── Render override for webpage items in client viewer ──
  const renderWebpageClientView = useCallback((item: ReviewItem) => (
    <div className="flex items-center justify-center h-full p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#017C87]/10 flex items-center justify-center mx-auto mb-4">
          <Globe size={24} className="text-[#017C87]" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          Leave feedback on the live page
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          This page has a feedback widget installed. Visit the page directly to
          leave pin comments, take screenshots, and record your screen.
        </p>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#017C87] hover:bg-[#015c64] transition-colors"
          >
            <ExternalLink size={14} />
            Visit Page
          </a>
        )}
        {item.url && (
          <p className="text-xs text-gray-400 mt-3 truncate px-4">{item.url}</p>
        )}
      </div>
    </div>
  ), []);

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

  const pinComments = topLevelComments.filter(
    (c) => c.comment_type === 'pin' && c.pin_x != null && c.pin_y != null
  );

  // Helper to handle filter change + auto-select first item
  const handleFilterChange = (type: string | null) => {
    setTypeFilter(type);
    if (type) {
      const first = items.find((i) => i.type === type);
      if (first) setSelectedItemId(first.id);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* ── Mobile header ── */}
      <div
        className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b shrink-0 z-20"
        style={{ backgroundColor: bgSecondary, borderColor: border }}
      >
        <button onClick={() => setMobileSidebar(true)} className="p-2" style={{ color: sidebarText }}>
          <Menu size={20} />
        </button>
        <div className="flex-1 min-w-0 mx-1 flex items-center justify-center gap-1">
          <button onClick={() => goToItem(currentIdx - 1)} disabled={currentIdx <= 0}
            className="p-1.5 disabled:opacity-20" style={{ color: sidebarText }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs truncate px-1" style={{ color: sidebarText, opacity: 0.55 }}>
            {selectedItem?.title || 'No items'} · {currentIdx + 1}/{filteredItems.length}
          </span>
          <button onClick={() => goToItem(currentIdx + 1)} disabled={currentIdx >= filteredItems.length - 1}
            className="p-1.5 disabled:opacity-20" style={{ color: sidebarText }}>
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          onClick={() => setShowComments(!showComments)}
          className="relative p-2"
          style={{ color: showComments ? accent : sidebarText, opacity: showComments ? 1 : 0.55 }}
        >
          <MessageSquare size={18} />
          {unresolvedComments.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
          )}
        </button>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-[220px] shrink-0 border-r overflow-hidden"
        style={{ backgroundColor: bgSecondary, borderColor: border }}
      >
        {/* Logo / title */}
        <div className="px-4 py-4 border-b" style={{ borderColor: border }}>
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-7 w-auto max-w-[160px] object-contain" />
          ) : branding.name ? (
            <span className="text-sm font-semibold" style={{
              color: sidebarText,
              fontFamily: fontFamily(branding.font_heading),
            }}>{branding.name}</span>
          ) : null}
          <p className="text-xs mt-1.5 truncate" style={{ color: `${sidebarText}88` }}>
            {project?.title}
          </p>
        </div>

        {/* Items list */}
        <nav className="flex-1 overflow-y-auto">
          {/* Filter tabs */}
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
                  onClick={() => { setSelectedItemId(item.id); setPendingPin(null); setPlacingPin(false); }}
                  className="w-full text-left rounded-lg p-2 transition-colors"
                  style={{ backgroundColor: isActive ? `${sidebarText}12` : 'transparent' }}
                >
                  {/* Thumbnail */}
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
                    <span className="text-xs font-medium truncate" style={{
                      color: isActive ? sidebarText : `${sidebarText}77`,
                      fontFamily: fontFamily(branding.font_sidebar),
                    }}>
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

      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileSidebar(false)}>
          <div className="w-[260px] h-full border-r overflow-y-auto"
            style={{ backgroundColor: bgSecondary, borderColor: border }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border }}>
              <span className="text-sm font-medium" style={{ color: sidebarText }}>Items</span>
              <button onClick={() => setMobileSidebar(false)} style={{ color: `${sidebarText}55` }}><X size={18} /></button>
            </div>
            {/* Filter tabs */}
            <div className="px-3 pt-2 pb-1">
              <TypeFilterTabs
                items={items}
                availableTypes={availableTypes}
                typeFilter={typeFilter}
                onFilterChange={handleFilterChange}
                variant="branded"
                sidebarTextColor={sidebarText}
                showCounts={false}
              />
            </div>
            <nav className="p-2 space-y-1">
              {filteredItems.map((item) => {
                const isActive = item.id === selectedItemId;
                const thumbUrl = item.image_url || item.screenshot_url;
                return (
                  <button key={item.id}
                    onClick={() => { setSelectedItemId(item.id); setMobileSidebar(false); setPendingPin(null); }}
                    className="w-full text-left rounded-lg p-2 transition-colors"
                    style={{ backgroundColor: isActive ? `${sidebarText}12` : 'transparent' }}>
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
                      <div className="w-full aspect-video rounded overflow-hidden mb-1.5" style={{ backgroundColor: `${sidebarText}08` }}>
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : null}
                    <span className="text-xs font-medium truncate block" style={{ color: isActive ? sidebarText : `${sidebarText}77` }}>
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Desktop toolbar */}
        <div className="hidden lg:flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
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

          <div className="flex items-center gap-2">
            {/* Place pin button — only for image/ad items */}
            {!isWebpageItem && (
              <button
                onClick={() => { setPlacingPin(!placingPin); setPendingPin(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  placingPin
                    ? 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]'
                    : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <MapPin size={13} />
                {placingPin ? 'Click to place pin' : 'Add Pin'}
              </button>
            )}
          </div>
        </div>

        {/* Item viewer */}
        <div
          className={`flex-1 ${
            isWebpageItem
              ? 'overflow-auto'
              : 'overflow-auto flex items-center justify-center p-4 lg:p-8'
          } bg-gray-50`}
        >
          <ItemContentView
            item={selectedItem}
            placingPin={placingPin}
            pendingPin={pendingPin}
            pinComments={pinComments}
            onImageClick={handleImageClick}
            onPinClick={handlePinClick}
            containerRef={imageContainerRef}
            shareToken={params.token}
            renderWebpage={renderWebpageClientView}
            emptyText="No items to review"
          />
        </div>

        {/* Mobile: Add Pin FAB — only for image/ad items */}
        {!isWebpageItem && (
          <div className="lg:hidden fixed bottom-4 right-4 z-30 flex gap-2">
            <button
              onClick={() => { setPlacingPin(!placingPin); setPendingPin(null); }}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-colors ${
                placingPin
                  ? 'bg-[#017C87] text-white border-[#017C87]'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              <MapPin size={20} />
            </button>
          </div>
        )}
      </div>

      {/* ── Comments panel — always visible on desktop, toggleable on mobile ── */}
      <CommentsPanel
        variant="client"
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
        className={`
          ${showComments ? 'fixed inset-0 z-40' : 'hidden'}
          lg:flex lg:relative lg:inset-auto lg:z-auto lg:w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white
        `}
      />
    </div>
  );
}