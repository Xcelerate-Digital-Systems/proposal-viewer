// app/ads/swipe/[typeId]/page.tsx
'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import SwipeFileManager from '@/components/admin/ads/swipe/SwipeFileManager';

export default function SwipeFileTypePage({ params }: { params: { typeId: string } }) {
  return (
    <AdminLayout>
      {(auth) => <SwipeFileManager companyId={auth.companyId!} typeId={params.typeId} />}
    </AdminLayout>
  );
}
