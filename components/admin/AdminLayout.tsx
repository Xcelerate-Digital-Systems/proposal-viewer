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
import { TourProvider } from '@/components/tours/TourProvider';
import { BillingGuard } from '@/components/auth/BillingGuard';
import { AnalyticsIdentifier } from '@/components/analytics/AnalyticsIdentifier';
import { CrispWidget } from '@/components/support/CrispWidget';
import { supabase } from '@/lib/supabase';
import { setBrandingColors } from '@/components/ui/ColorPickerField';
import { useCompanyBranding } from '@/hooks/useCompanyBranding';

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
      {(auth) => (
        <AdminLayoutInner
          auth={auth}
          collapseSidebar={collapseSidebar}
          inSwipeSection={inSwipeSection}
          feedbackBoardProjectId={feedbackBoardProjectId}
          funnelBoardId={funnelBoardId}
        >
          {children}
        </AdminLayoutInner>
      )}
    </AuthGuard>
  );
}

function AdminLayoutInner({
  auth,
  collapseSidebar,
  inSwipeSection,
  feedbackBoardProjectId,
  funnelBoardId,
  children,
}: {
  auth: ReturnType<typeof useAuth>;
  collapseSidebar?: boolean;
  inSwipeSection: boolean;
  feedbackBoardProjectId: string | null;
  funnelBoardId: string | null;
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
}) {
  const sidebarBranding = useCompanyBranding(
    auth.companyId ?? null,
    auth.accountType,
  );

  const content = (
    <div className="flex h-dvh bg-ivory overflow-hidden" data-tour="admin-layout">
      {auth.session?.user && auth.teamMember && auth.companyId && (
        <>
          <AnalyticsIdentifier
            userId={auth.session.user.id}
            email={auth.session.user.email}
            name={auth.teamMember.name}
            companyId={auth.companyId}
            role={auth.teamMember.role}
            accountType={auth.accountType}
          />
          <CrispWidget
            userEmail={auth.session.user.email}
            userName={auth.teamMember.name}
          />
        </>
      )}
      {auth.companyId && <BrandPaletteLoader companyId={auth.companyId} />}
      {!collapseSidebar && (
        <AdminSidebar
          memberName={auth.teamMember?.name}
          memberEmail={auth.teamMember?.email}
          memberRole={auth.teamMember?.role}
          memberAvatarPath={auth.teamMember?.avatar_path}
          companyId={auth.companyId ?? undefined}
          userId={auth.session?.user?.id ?? null}
          isSuperAdmin={auth.isSuperAdmin}
          isAgencyAdmin={auth.isAgencyAdmin}
          accountType={auth.accountType}
          companyOverride={auth.companyOverride}
          onClearOverride={auth.clearCompanyOverride}
          onSetOverride={auth.setCompanyOverride}
          memberships={auth.memberships}
          activeMembershipId={auth.activeMembership?.id ?? null}
          onSwitchMembership={auth.setActiveMembership}
          onSignOut={auth.signOut}
          sidebarBranding={sidebarBranding}
        />
      )}
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        {children(auth)}
      </main>
    </div>
  );

  let wrapped: React.ReactNode = content;

  if (inSwipeSection && auth.companyId) {
    wrapped = <SwipeFileProvider companyId={auth.companyId}>{wrapped}</SwipeFileProvider>;
  } else if (feedbackBoardProjectId && auth.companyId) {
    wrapped = (
      <FeedbackBoardProvider
        projectId={feedbackBoardProjectId}
        companyId={auth.companyId}
        userId={auth.session?.user?.id ?? null}
      >
        {wrapped}
      </FeedbackBoardProvider>
    );
  } else if (funnelBoardId && auth.companyId) {
    wrapped = (
      <FunnelBoardProvider
        funnelId={funnelBoardId}
        companyId={auth.companyId}
        userId={auth.session?.user?.id ?? null}
      >
        {wrapped}
      </FunnelBoardProvider>
    );
  }

  const guarded = auth.companyId && auth.teamMember ? (
    <BillingGuard
      companyId={auth.companyId}
      accountType={auth.accountType}
      role={auth.teamMember.role}
    >
      {wrapped}
    </BillingGuard>
  ) : (
    wrapped
  );

  return <TourProvider>{guarded}</TourProvider>;
}
