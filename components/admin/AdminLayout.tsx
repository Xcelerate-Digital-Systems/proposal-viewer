// components/admin/AdminLayout.tsx
'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';

interface AdminLayoutProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AuthGuard>
      {(auth) => (
        <div className="flex min-h-screen bg-[#0f0f0f]">
          <AdminSidebar
            memberName={auth.teamMember?.name}
            memberEmail={auth.teamMember?.email}
            memberRole={auth.teamMember?.role}
            companyId={auth.companyId ?? undefined}
            isSuperAdmin={auth.isSuperAdmin}
            companyOverride={auth.companyOverride}
            onClearOverride={auth.clearCompanyOverride}
            onSignOut={auth.signOut}
          />
          <main className="flex-1 min-w-0 lg:h-screen lg:overflow-y-auto">
            {children(auth)}
          </main>
        </div>
      )}
    </AuthGuard>
  );
}