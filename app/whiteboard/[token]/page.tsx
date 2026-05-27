// app/whiteboard/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor } from 'lucide-react';
import { type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackBoardEdge, type FeedbackBoardNote, type FeedbackBoardShape } from '@/lib/supabase';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import { useGuestIdentity } from '@/hooks/useGuestIdentity';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import FeedbackBoardViewer from '@/components/feedback/public/FeedbackBoardViewer';
import FeedbackNotFound from '@/components/feedback/FeedbackNotFound';
import WhiteboardSidebar from '@/components/feedback/public/WhiteboardSidebar';
import WhiteboardTour from '@/components/feedback/public/WhiteboardTour';
import GuestOnboardingModal from '@/components/feedback/GuestOnboardingModal';

/**
 * Public whiteboard view — /whiteboard/[token]
 *
 * Read-only React Flow canvas showing all items as nodes,
 * with edges, sticky notes, and comment badges.
 * Accessed via review_projects.board_share_token.
 *
 * Clicking a node navigates (same tab) to the /review/[token]?item=[itemId] view
 * where the client can see the item details and leave comments.
 * A back param is included so the review page can show a "Back to board" button.
 */
export default function PublicWhiteboardPage(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [boardEdges, setBoardEdges] = useState<FeedbackBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FeedbackBoardNote[]>([]);
  const [boardShapes, setBoardShapes] = useState<FeedbackBoardShape[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  const { bgSecondary, sidebarText } = useBrandingColors(branding);

  // ── Guest identity ──
  // Collect name + email on first visit so the reviewer isn't prompted again
  // when they click into an individual item. The key is shared with the
  // /review/[token] route and the embedded widget.
  const { guestName, saveGuestIdentity, hydrated: identityHydrated } = useGuestIdentity();
  const showOnboarding = identityHydrated && !guestName && !loading && !notFound;

  // Fetch via the /api/whiteboard/[token] endpoint
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/whiteboard/${params.token}`, { cache: 'no-store' });
        if (!res.ok) { setNotFound(true); setLoading(false); setBrandingLoaded(true); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);
        setComments(data.comments);
        setBoardEdges(data.boardEdges || []);
        setBoardNotes(data.boardNotes || []);
        setBoardShapes(data.boardShapes || []);

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
      document.title = project.title || project.client_name || 'Feedback';
    }
    return () => { document.title = 'Feedback'; };
  }, [project]);

  // Clicking a board node — navigate (same tab) to item detail view.
  // Includes a back param so the review page shows a "Back to board" button.
  const handleSelectItem = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);

    // Webpage items with a URL → open the live URL directly
    if (item?.type === 'webpage' && item.url) {
      window.open(item.url, '_blank');
      return;
    }

    const boardBackUrl = `/whiteboard/${params.token}`;
    if (item?.share_token) {
      router.push(`/review/${item.share_token}?back=${encodeURIComponent(boardBackUrl)}`);
      return;
    }

    // Fall back to project share token with deep-link to this item
    if (project?.share_token) {
      router.push(`/review/${project.share_token}?item=${itemId}&back=${encodeURIComponent(boardBackUrl)}`);
    }
  }, [items, project, params.token, router]);

  // ── Early returns ──
  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading board…" />;
  if (notFound) return <FeedbackNotFound type="not_found" />;

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

      {/* Mobile — desktop required message */}
      <div className="flex lg:hidden min-h-screen items-center justify-center bg-surface p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Monitor size={24} className="text-faint" />
          </div>
          <h2 className="text-base font-semibold text-prose">Desktop Required</h2>
          <p className="text-sm text-dim mt-2 leading-relaxed">
            Please open this board on a desktop browser for the best experience.
          </p>
        </div>
      </div>

      {/* Desktop — board view */}
      <div className="hidden lg:flex h-dvh flex-col bg-surface overflow-hidden">
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
          <p className="text-xs" style={{ color: `${sidebarText}55` }}>
            Click any item to view details and leave feedback
          </p>
        </div>

        {/* Sidebar + Board canvas */}
        <div className="flex-1 min-h-0 flex">
          <WhiteboardSidebar
            items={items}
            comments={comments}
            branding={branding}
            bgSecondary={bgSecondary}
            sidebarText={sidebarText}
            onSelectItem={handleSelectItem}
          />
          <div className="flex-1 min-h-0">
            <FeedbackBoardViewer
              items={items}
              boardEdges={boardEdges}
              boardNotes={boardNotes}
              boardShapes={boardShapes}
              comments={comments}
              branding={branding}
              onSelectItem={handleSelectItem}
            />
          </div>
        </div>

        <WhiteboardTour
          enabled={identityHydrated && !!guestName && !loading && !notFound}
          accentColor={branding.accent_color}
          fontHeading={branding.font_heading}
        />
      </div>
    </>
  );
}