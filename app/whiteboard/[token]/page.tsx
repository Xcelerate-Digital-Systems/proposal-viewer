// app/whiteboard/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { type ReviewProject, type ReviewItem, type ReviewComment, type ReviewBoardEdge, type ReviewBoardNote } from '@/lib/supabase';
import { type CompanyBranding } from '@/hooks/useProposal';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import ReviewBoardViewer from '@/components/review/ReviewBoardViewer';
import ReviewNotFound from '@/components/reviews/ReviewNotFound';

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

/**
 * Public whiteboard view — /whiteboard/[token]
 *
 * Read-only React Flow canvas showing all items as nodes,
 * with edges, sticky notes, and comment badges.
 * Accessed via review_projects.board_share_token.
 *
 * Clicking a node opens the item in the /review/[itemToken] view
 * if the item has its own share token, otherwise it's view-only.
 */
export default function PublicWhiteboardPage({ params }: { params: { token: string } }) {
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [boardEdges, setBoardEdges] = useState<ReviewBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<ReviewBoardNote[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  // Fetch via the /api/whiteboard/[token] endpoint
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/whiteboard/${params.token}`);
        if (!res.ok) { setNotFound(true); setLoading(false); setBrandingLoaded(true); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);
        setComments(data.comments);
        setBoardEdges(data.boardEdges || []);
        setBoardNotes(data.boardNotes || []);

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

  // Tab title
  useEffect(() => {
    if (project) {
      document.title = project.client_name
        ? `Board — ${project.client_name}`
        : `Board — ${project.title}`;
    }
    return () => { document.title = 'Creative Review'; };
  }, [project]);

  // Clicking a board node — open item in its own shared view if it has a token
  const handleSelectItem = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.share_token) {
      window.open(`/review/${item.share_token}`, '_blank');
    }
    // If no item share token, do nothing (view-only on board)
  }, [items]);

  // ── Early returns ──
  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading board…" />;
  if (notFound) return <ReviewNotFound type="not_found" />;

  return (
    <div className="h-dvh flex flex-col bg-gray-50 overflow-hidden">
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Board header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-6 w-auto max-w-[120px] object-contain" />
          ) : branding.name ? (
            <span className="text-sm font-semibold text-gray-800"
              style={{ fontFamily: fontFamily(branding.font_heading) }}>
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

      {/* Board canvas — needs explicit height for ReactFlow */}
      <div className="flex-1 min-h-0">
        <ReviewBoardViewer
          items={items}
          boardEdges={boardEdges}
          boardNotes={boardNotes}
          comments={comments}
          branding={branding}
          onSelectItem={handleSelectItem}
        />
      </div>
    </div>
  );
}