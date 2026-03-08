// components/admin/AdminLayout.tsx
'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';

interface AdminLayoutProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
  /** When true, hides the main admin sidebar on desktop (useful for full-width viewer layouts) */
  collapseSidebar?: boolean;
}

export default function AdminLayout({ children, collapseSidebar }: AdminLayoutProps) {
  return (
    <AuthGuard>
      {(auth) => (
        <div className="flex h-dvh bg-gray-50 overflow-hidden">
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
      )}
    </AuthGuard>
  );
}