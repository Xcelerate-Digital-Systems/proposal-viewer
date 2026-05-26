// app/ads/swipe/[typeId]/page.tsx
'use client';;
import { use } from "react";

import AdminLayout from '@/components/admin/AdminLayout';
import SwipeFileManager from '@/components/admin/ads/swipe/SwipeFileManager';

export default function SwipeFileTypePage(props: { params: Promise<{ typeId: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => <SwipeFileManager companyId={auth.companyId!} typeId={params.typeId} />}
    </AdminLayout>
  );
}
