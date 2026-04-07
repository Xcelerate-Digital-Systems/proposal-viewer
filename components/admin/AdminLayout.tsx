// components/admin/AdminLayout.tsx
'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';
import { SwipeFileProvider } from '@/components/admin/ads/swipe/SwipeFileContext';

interface AdminLayoutProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
  /** When true, hides the main admin sidebar on desktop (useful for full-width viewer layouts) */
  collapseSidebar?: boolean;
}

export default function AdminLayout({ children, collapseSidebar }: AdminLayoutProps) {
  const pathname = usePathname();
  const inSwipeSection = pathname?.startsWith('/ads/swipe') ?? false;

  return (
    <AuthGuard>
      {(auth) => {
        const content = (
          <div className="flex h-dvh bg-ivory overflow-hidden">
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

        return content;
      }}
    </AuthGuard>
  );
}
