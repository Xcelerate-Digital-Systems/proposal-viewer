// app/review/[token]/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, ChevronLeft, ChevronRight, Menu, X, Send,
  CheckCircle2, CornerDownRight, ChevronDown, Image as ImageIcon,
  MapPin, Building2,
} from 'lucide-react';
import { type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/reviews/AdMockupPreview';
import { type CompanyBranding, deriveBorderColor, deriveSurfaceColor } from '@/hooks/useProposal';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';

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

  // Pin placement mode
  const [placingPin, setPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);

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
        if (data.items.length > 0) setSelectedItemId(data.items[0].id);

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

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;
  const itemComments = comments.filter((c) => c.review_item_id === selectedItemId);
  const topLevelComments = itemComments.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId: string) => itemComments.filter((c) => c.parent_comment_id === parentId);
  const unresolvedComments = topLevelComments.filter((c) => !c.resolved);
  const resolvedComments = topLevelComments.filter((c) => c.resolved);

  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const border = deriveBorderColor(bgSecondary);
  const surface = deriveSurfaceColor(bgPrimary, bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';

  // ── Pin click handler ──
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setPlacingPin(false);
    setShowComments(true);
  };

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
  const currentIdx = items.findIndex((i) => i.id === selectedItemId);
  const goToItem = (idx: number) => {
    if (idx >= 0 && idx < items.length) {
      setSelectedItemId(items[idx].id);
      setPendingPin(null);
      setPlacingPin(false);
    }
  };

  // ── Early returns ──
  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading review…" />;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgPrimary }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: bgSecondary }}>
            <ImageIcon size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Review Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  // ── Pin markers for current item ──
  const pinComments = topLevelComments.filter(
    (c) => c.comment_type === 'pin' && c.pin_x != null && c.pin_y != null
  );

  return (
    <div className="flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: bgPrimary, height: '100dvh' }}>
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
            {selectedItem?.title || 'No items'} · {currentIdx + 1}/{items.length}
          </span>
          <button onClick={() => goToItem(currentIdx + 1)} disabled={currentIdx >= items.length - 1}
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

      {/* ── Item sidebar (desktop) ── */}
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
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {items.map((item, idx) => {
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
                style={{
                  backgroundColor: isActive ? `${sidebarText}12` : 'transparent',
                }}
              >
                {/* Thumbnail */}
                {thumbUrl && (
                  <div className="w-full aspect-video rounded overflow-hidden mb-1.5"
                    style={{ backgroundColor: `${sidebarText}08` }}>
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
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
            <nav className="p-2 space-y-1">
              {items.map((item) => {
                const isActive = item.id === selectedItemId;
                const thumbUrl = item.image_url || item.screenshot_url;
                return (
                  <button key={item.id}
                    onClick={() => { setSelectedItemId(item.id); setMobileSidebar(false); setPendingPin(null); }}
                    className="w-full text-left rounded-lg p-2 transition-colors"
                    style={{ backgroundColor: isActive ? `${sidebarText}12` : 'transparent' }}>
                    {thumbUrl && (
                      <div className="w-full aspect-video rounded overflow-hidden mb-1.5" style={{ backgroundColor: `${sidebarText}08` }}>
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
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
        {/* Toolbar */}
        <div className="hidden lg:flex items-center justify-between px-4 py-2.5 border-b shrink-0"
          style={{ backgroundColor: bgSecondary, borderColor: border }}>
          <div className="flex items-center gap-2">
            <button onClick={() => goToItem(currentIdx - 1)} disabled={currentIdx <= 0}
              className="p-1.5 rounded-lg disabled:opacity-20 transition-opacity" style={{ color: sidebarText }}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm" style={{ color: `${sidebarText}88` }}>
              {selectedItem?.title}
              <span style={{ opacity: 0.5 }}> · {currentIdx + 1} of {items.length}</span>
            </span>
            <button onClick={() => goToItem(currentIdx + 1)} disabled={currentIdx >= items.length - 1}
              className="p-1.5 rounded-lg disabled:opacity-20 transition-opacity" style={{ color: sidebarText }}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Place pin button */}
            <button
              onClick={() => { setPlacingPin(!placingPin); setPendingPin(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: placingPin ? `${accent}22` : 'transparent',
                color: placingPin ? accent : `${sidebarText}77`,
                border: `1px solid ${placingPin ? accent : border}`,
              }}
            >
              <MapPin size={13} />
              {placingPin ? 'Click image to place' : 'Add Pin'}
            </button>

            {/* Toggle comments */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: showComments ? `${accent}22` : 'transparent',
                color: showComments ? accent : `${sidebarText}77`,
                border: `1px solid ${showComments ? accent : border}`,
              }}
            >
              <MessageSquare size={13} />
              Comments
              {unresolvedComments.length > 0 && (
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: accent, color: branding.accept_text_color || '#fff' }}>
                  {unresolvedComments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Item viewer with pin overlay */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 lg:p-8"
          style={{ backgroundColor: bgPrimary }}>
          {selectedItem ? (
            <div
              ref={imageContainerRef}
              className="relative max-w-full max-h-full"
              style={{ cursor: placingPin ? 'crosshair' : 'default' }}
              onClick={handleImageClick}
            >
              {/* Ad mockup rendering */}
              {selectedItem.type === 'ad' && selectedItem.ad_creative_url && (
                <div className="select-none">
                  <AdMockupPreview
                    creativeUrl={selectedItem.ad_creative_url}
                    headline={selectedItem.ad_headline || ''}
                    primaryText={selectedItem.ad_copy || ''}
                    ctaText={selectedItem.ad_cta || 'Learn More'}
                    platform={(selectedItem.ad_platform as AdPlatform) || 'facebook_feed'}
                    pageName={branding.name || 'Your Brand'}
                    pageImageUrl={branding.logo_url || undefined}
                    showPlatformToggle
                    dark
                    accentColor={accent}
                  />
                </div>
              )}

              {/* Image rendering (non-ad items) */}
              {selectedItem.type !== 'ad' && (selectedItem.image_url || selectedItem.screenshot_url) && (
                <img
                  src={selectedItem.image_url || selectedItem.screenshot_url || ''}
                  alt={selectedItem.title}
                  className="max-w-full max-h-[calc(100dvh-120px)] object-contain rounded-lg select-none"
                  draggable={false}
                />
              )}

              {/* Existing pin markers */}
              {pinComments.map((c) => (
                <button
                  key={c.id}
                  className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg z-10 transition-transform hover:scale-110"
                  style={{
                    left: `${c.pin_x}%`,
                    top: `${c.pin_y}%`,
                    backgroundColor: c.resolved ? '#6b7280' : accent,
                    color: branding.accept_text_color || '#fff',
                    opacity: c.resolved ? 0.5 : 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                  title={`#${c.thread_number}: ${c.content.slice(0, 50)}`}
                >
                  {c.thread_number || '•'}
                </button>
              ))}

              {/* Pending pin (not yet submitted) */}
              {pendingPin && (
                <div
                  className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg animate-pulse z-10"
                  style={{
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                    backgroundColor: accent,
                    color: branding.accept_text_color || '#fff',
                  }}
                >
                  +
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <ImageIcon size={40} className="text-[#333] mx-auto mb-3" />
              <p className="text-[#666] text-sm">No items to review</p>
            </div>
          )}
        </div>

        {/* Mobile: Add Pin FAB */}
        <div className="lg:hidden fixed bottom-4 right-4 z-30 flex gap-2">
          <button
            onClick={() => { setPlacingPin(!placingPin); setPendingPin(null); }}
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            style={{ backgroundColor: placingPin ? accent : bgSecondary, color: placingPin ? '#fff' : `${sidebarText}88`, border: `1px solid ${border}` }}
          >
            <MapPin size={20} />
          </button>
        </div>
      </div>

      {/* ── Comments panel ── */}
      {showComments && (
        <div
          className="fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto lg:w-[340px] shrink-0 flex flex-col border-l"
          style={{ backgroundColor: bgSecondary, borderColor: border }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: border }}>
            <span className="text-sm font-medium" style={{ color: sidebarText }}>
              Comments
              {unresolvedComments.length > 0 && (
                <span className="ml-1.5 text-xs" style={{ color: `${sidebarText}55` }}>
                  ({unresolvedComments.length} open)
                </span>
              )}
            </span>
            <button onClick={() => setShowComments(false)} className="p-1 rounded" style={{ color: `${sidebarText}55` }}>
              <X size={16} />
            </button>
          </div>

          {/* Comment threads */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Pending pin comment form */}
            {pendingPin && (
              <PendingPinForm
                guestName={guestName}
                onNameChange={setGuestName}
                onSubmit={async (content) => {
                  await submitComment(content, pendingPin.x, pendingPin.y);
                }}
                onCancel={() => setPendingPin(null)}
                accent={accent}
                sidebarText={sidebarText}
                surface={surface}
                border={border}
              />
            )}

            {/* Unresolved threads */}
            {unresolvedComments.map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                replies={getReplies(c.id)}
                guestName={guestName}
                onNameChange={setGuestName}
                onReply={async (content) => {
                  await submitComment(content, undefined, undefined, c.id);
                }}
                accent={accent}
                sidebarText={sidebarText}
                surface={surface}
                border={border}
              />
            ))}

            {/* Resolved */}
            {resolvedComments.length > 0 && (
              <ResolvedSection
                comments={resolvedComments}
                getReplies={getReplies}
                sidebarText={sidebarText}
                surface={surface}
                border={border}
              />
            )}

            {topLevelComments.length === 0 && !pendingPin && (
              <div className="text-center py-8">
                <MapPin size={24} className="mx-auto mb-2" style={{ color: `${sidebarText}30` }} />
                <p className="text-xs" style={{ color: `${sidebarText}44` }}>
                  Click &ldquo;Add Pin&rdquo; to place a comment on the image
                </p>
              </div>
            )}
          </div>

          {/* General comment form (non-pin) */}
          <GeneralCommentForm
            guestName={guestName}
            onNameChange={setGuestName}
            onSubmit={async (content) => {
              await submitComment(content);
            }}
            accent={accent}
            sidebarText={sidebarText}
            surface={surface}
            border={border}
          />
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function PendingPinForm({
  guestName, onNameChange, onSubmit, onCancel,
  accent, sidebarText, surface, border,
}: {
  guestName: string;
  onNameChange: (v: string) => void;
  onSubmit: (content: string) => Promise<void>; onCancel: () => void;
  accent: string; sidebarText: string; surface: string; border: string;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !guestName.trim()) return;
    setSubmitting(true);
    await onSubmit(text);
    setText('');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg p-3 space-y-2" style={{ backgroundColor: surface, border: `1px solid ${accent}44` }}>
      <div className="flex items-center gap-1.5 mb-1">
        <MapPin size={12} style={{ color: accent }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
          New Pin Comment
        </span>
        <button type="button" onClick={onCancel} className="ml-auto p-0.5" style={{ color: `${sidebarText}44` }}>
          <X size={12} />
        </button>
      </div>
      <NameField name={guestName} onNameChange={onNameChange} sidebarText={sidebarText} border={border} />
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus
        placeholder="Describe your feedback…"
        className="w-full px-2.5 py-2 rounded text-xs resize-none focus:outline-none"
        style={{ backgroundColor: `${sidebarText}08`, color: sidebarText, border: `1px solid ${border}` }}
      />
      <button type="submit" disabled={!text.trim() || !guestName.trim() || submitting}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-opacity disabled:opacity-40"
        style={{ backgroundColor: accent, color: '#fff' }}>
        <Send size={11} /> {submitting ? 'Sending…' : 'Post Comment'}
      </button>
    </form>
  );
}

function GeneralCommentForm({
  guestName, onNameChange, onSubmit,
  accent, sidebarText, surface, border,
}: {
  guestName: string;
  onNameChange: (v: string) => void;
  onSubmit: (content: string) => Promise<void>;
  accent: string; sidebarText: string; surface: string; border: string;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !guestName.trim()) return;
    setSubmitting(true);
    await onSubmit(text);
    setText('');
    setSubmitting(false);
    setExpanded(false);
  };

  return (
    <div className="border-t px-4 py-3 shrink-0" style={{ borderColor: border }}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg text-xs"
          style={{ backgroundColor: `${sidebarText}08`, color: `${sidebarText}55`, border: `1px solid ${border}` }}
        >
          Leave a general comment…
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <NameField name={guestName} onNameChange={onNameChange} sidebarText={sidebarText} border={border} />
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus
            placeholder="Your comment…"
            className="w-full px-2.5 py-2 rounded text-xs resize-none focus:outline-none"
            style={{ backgroundColor: `${sidebarText}08`, color: sidebarText, border: `1px solid ${border}` }}
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setExpanded(false)} className="text-xs px-2 py-1" style={{ color: `${sidebarText}55` }}>
              Cancel
            </button>
            <button type="submit" disabled={!text.trim() || !guestName.trim() || submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
              style={{ backgroundColor: accent, color: '#fff' }}>
              <Send size={11} /> Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NameField({
  name, onNameChange, sidebarText, border,
}: {
  name: string;
  onNameChange: (v: string) => void;
  sidebarText: string; border: string;
}) {
  return (
    <input
      type="text" value={name} onChange={(e) => onNameChange(e.target.value)}
      placeholder="Your name *"
      className="w-full px-2.5 py-1.5 rounded text-xs focus:outline-none"
      style={{ backgroundColor: `${sidebarText}08`, color: sidebarText, border: `1px solid ${border}` }}
    />
  );
}

function CommentThread({
  comment, replies, guestName, onNameChange, onReply,
  accent, sidebarText, surface, border,
}: {
  comment: ReviewComment; replies: ReviewComment[];
  guestName: string;
  onNameChange: (v: string) => void;
  onReply: (content: string) => Promise<void>;
  accent: string; sidebarText: string; surface: string; border: string;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !guestName.trim()) return;
    setSubmitting(true);
    await onReply(replyText);
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: surface }}>
      {/* Pin badge */}
      {comment.comment_type === 'pin' && comment.thread_number && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: accent, color: '#fff' }}>
            {comment.thread_number}
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: `${sidebarText}44` }}>Pin</span>
        </div>
      )}

      {/* Main comment */}
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
          style={{ backgroundColor: `${sidebarText}12`, color: `${sidebarText}77` }}>
          {comment.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: sidebarText }}>{comment.author_name}</span>
            <span className="text-[10px]" style={{ color: `${sidebarText}44` }}>{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: `${sidebarText}bb` }}>{comment.content}</p>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-2 ml-4 pl-4 space-y-2" style={{ borderLeft: `2px solid ${border}` }}>
          {replies.map((r) => (
            <div key={r.id} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
                style={{ backgroundColor: `${sidebarText}12`, color: `${sidebarText}77` }}>
                {r.author_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium" style={{ color: sidebarText }}>{r.author_name}</span>
                  <span className="text-[10px]" style={{ color: `${sidebarText}44` }}>{timeAgo(r.created_at)}</span>
                </div>
                <p className="text-[11px] mt-0.5 whitespace-pre-wrap" style={{ color: `${sidebarText}bb` }}>{r.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply action */}
      {!showReply ? (
        <button
          onClick={() => setShowReply(true)}
          className="flex items-center gap-1 mt-2 ml-8 text-[10px] font-medium transition-colors"
          style={{ color: `${sidebarText}55` }}
        >
          <CornerDownRight size={10} /> Reply
        </button>
      ) : (
        <form onSubmit={handleReply} className="mt-2 ml-8 space-y-1.5">
          {!guestName && (
            <NameField name={guestName} onNameChange={onNameChange} sidebarText={sidebarText} border={border} />
          )}
          <div className="flex gap-1.5">
            <input
              type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…" autoFocus
              className="flex-1 px-2 py-1.5 rounded text-[11px] focus:outline-none"
              style={{ backgroundColor: `${sidebarText}08`, color: sidebarText, border: `1px solid ${border}` }}
            />
            <button type="submit" disabled={!replyText.trim() || !guestName.trim() || submitting}
              className="p-1.5 rounded disabled:opacity-40" style={{ backgroundColor: accent, color: '#fff' }}>
              <Send size={11} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ResolvedSection({
  comments, getReplies, sidebarText, surface, border,
}: {
  comments: ReviewComment[]; getReplies: (id: string) => ReviewComment[];
  sidebarText: string; surface: string; border: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full py-2 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: `${sidebarText}44` }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Resolved ({comments.length})
      </button>
      {expanded && (
        <div className="space-y-2 opacity-60">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg p-3" style={{ backgroundColor: surface }}>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ backgroundColor: `${sidebarText}12`, color: `${sidebarText}55` }}>
                  {c.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium" style={{ color: `${sidebarText}88` }}>{c.author_name}</span>
                  <p className="text-[11px] mt-0.5" style={{ color: `${sidebarText}66` }}>{c.content}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 size={10} style={{ color: '#22c55e' }} />
                    <span className="text-[10px]" style={{ color: `${sidebarText}44` }}>Resolved</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}