// app/whiteboard/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
 * Clicking a node navigates (same tab) to the /project/[token]?item=[itemId] view
 * where the client can see the item details and leave comments.
 * A back param is included so the project page can show a "Back to board" button.
 */
export default function PublicWhiteboardPage({ params }: { params: { token: string } }) {
  const router = useRouter();
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
        const res = await fetch(`/api/whiteboard/${params.token}`, { cache: 'no-store' });
        if (!res.ok) { setNotFound(true); setLoading(false); setBrandingLoaded(true); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);
        console.log('[BOARD DEBUG] Loaded items from API:', data.items.map((i: any) => ({ id: i.id, title: i.title, type: i.type })));
        setComments(data.comments);
        setBoardEdges(data.boardEdges || []);
        setBoardNotes(data.boardNotes || []);

        // Load branding
        const brandRes = await fetch(`/api/company/branding?company_id=${data.project.company_id}`, { cache: 'no-store' });
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

  // Clicking a board node — navigate (same tab) to item detail view.
  // Includes a back param so the project page shows a "Back to board" button.
  const handleSelectItem = useCallback((itemId: string) => {
    console.log('[BOARD DEBUG] handleSelectItem called with itemId:', itemId);
    console.log('[BOARD DEBUG] items in state:', items.map(i => ({ id: i.id, title: i.title })));
    const boardBackUrl = `/whiteboard/${params.token}`;

    // Prefer item's own share token for a focused single-item view
    const item = items.find((i) => i.id === itemId);
    if (item?.share_token) {
      router.push(`/review/${item.share_token}?back=${encodeURIComponent(boardBackUrl)}`);
      return;
    }

    // Fall back to project card grid with deep-link to this item
    if (project?.share_token) {
      router.push(`/project/${project.share_token}?item=${itemId}&back=${encodeURIComponent(boardBackUrl)}`);
    }
  }, [items, project, params.token, router]);

  // Branding-derived colors
  const bgSecondary = branding.bg_secondary || '#141414';
  const sidebarText = branding.sidebar_text_color || '#ffffff';

  // ── Early returns ──
  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading board…" />;
  if (notFound) return <ReviewNotFound type="not_found" />;

  return (
    <div className="h-dvh flex flex-col bg-gray-50 overflow-hidden">
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Board header — branded with sidebar colors */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ backgroundColor: bgSecondary, borderBottom: `1px solid ${sidebarText}15` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-6 w-auto max-w-[120px] object-contain" />
          ) : branding.name ? (
            <span className="text-sm font-semibold"
              style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}>
              {branding.name}
            </span>
          ) : null}
          <span
            className="text-sm truncate"
            style={{
              color: `${sidebarText}99`,
              fontFamily: fontFamily(branding.font_sidebar),
              fontWeight: branding.font_sidebar_weight || undefined,
            }}
          >
            {project?.title}
          </span>
        </div>
        <p className="text-xs hidden sm:block" style={{ color: `${sidebarText}55` }}>
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