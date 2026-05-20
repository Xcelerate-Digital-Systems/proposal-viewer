// components/admin/AdminLayout.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';
import { SwipeFileProvider } from '@/components/admin/ads/swipe/SwipeFileContext';
import { FeedbackBoardProvider } from '@/components/admin/feedback/board/FeedbackBoardContext';
import { FunnelBoardProvider } from '@/components/admin/funnels/board/FunnelBoardContext';
import { supabase } from '@/lib/supabase';
import { setBrandingColors } from '@/components/ui/ColorPickerField';

/* ------------------------------------------------------------------ */
/*  Brand palette loader — pushes companies.brand_colors into the      */
/*  global ColorPickerField swatch source so every admin page (quotes, */
/*  proposals, documents, templates, design tabs) shows brand swatches */
/*  without each editor needing its own loader.                        */
/* ------------------------------------------------------------------ */
function BrandPaletteLoader({ companyId }: { companyId: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('brand_colors')
        .eq('id', companyId)
        .single();
      if (cancelled) return;
      const palette = Array.isArray(data?.brand_colors) ? (data!.brand_colors as string[]) : [];
      setBrandingColors(palette);
    })();
    return () => { cancelled = true; };
  }, [companyId]);
  return null;
}

interface AdminLayoutProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
  /** When true, hides the main admin sidebar on desktop (useful for full-width viewer layouts) */
  collapseSidebar?: boolean;
}

export default function AdminLayout({ children, collapseSidebar }: AdminLayoutProps) {
  const pathname = usePathname();
  const inSwipeSection = pathname?.startsWith('/ads/swipe') ?? false;
  const feedbackBoardMatch = pathname?.match(/^\/feedback\/([^/]+)\/board/);
  const feedbackBoardProjectId = feedbackBoardMatch?.[1] ?? null;
  const funnelBoardMatch = pathname?.match(/^\/funnels\/([^/]+)\/board/);
  const funnelBoardId = funnelBoardMatch?.[1] ?? null;

  return (
    <AuthGuard>
      {(auth) => {
        const content = (
          <div className="flex h-dvh bg-ivory overflow-hidden">
            {auth.companyId && <BrandPaletteLoader companyId={auth.companyId} />}
            {!collapseSidebar && (
              <AdminSidebar
                memberName={auth.teamMember?.name}
                memberEmail={auth.teamMember?.email}
                memberRole={auth.teamMember?.role}
                companyId={auth.companyId ?? undefined}
                isSuperAdmin={auth.isSuperAdmin}
                isAgencyAdmin={auth.isAgencyAdmin}
                accountType={auth.accountType}
                companyOverride={auth.companyOverride}
                onClearOverride={auth.clearCompanyOverride}
                onSetOverride={auth.setCompanyOverride}
                onSignOut={auth.signOut}
              />
            )}
            <main className="flex-1 min-w-0 h-full overflow-y-auto">
              {children(auth)}
            </main>
          </div>
        );

        // Only wrap in SwipeFileProvider when we're in the swipe section + have a companyId
        if (inSwipeSection && auth.companyId) {
          return <SwipeFileProvider companyId={auth.companyId}>{content}</SwipeFileProvider>;
        }

        if (feedbackBoardProjectId && auth.companyId) {
          return (
            <FeedbackBoardProvider
              projectId={feedbackBoardProjectId}
              companyId={auth.companyId}
              userId={auth.session?.user?.id ?? null}
            >
              {content}
            </FeedbackBoardProvider>
          );
        }

        if (funnelBoardId && auth.companyId) {
          return (
            <FunnelBoardProvider
              funnelId={funnelBoardId}
              companyId={auth.companyId}
              userId={auth.session?.user?.id ?? null}
            >
              {content}
            </FunnelBoardProvider>
          );
        }

        return content;
      }}
    </AuthGuard>
  );
}
