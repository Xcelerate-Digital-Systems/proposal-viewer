// app/settings/connectors/meta/page.tsx
'use client';

import { Suspense } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import MetaConnectorPanel from '@/components/admin/connectors/MetaConnectorPanel';

export default function MetaConnectorSettingsPage() {
  return (
    <AdminLayout>
      {() => (
        <div className="px-6 lg:px-10 py-8 max-w-5xl">
          <Suspense fallback={null}>
            <MetaConnectorPanel />
          </Suspense>
        </div>
      )}
    </AdminLayout>
  );
}
