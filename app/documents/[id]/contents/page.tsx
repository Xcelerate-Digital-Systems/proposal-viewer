// app/documents/[id]/contents/page.tsx
'use client';

import TocTab from '@/components/admin/shared/TocTab';
import { useDocumentDetail } from '@/components/admin/documents/DocumentDetailContext';

export default function DocumentContentsPage() {
  const { document } = useDocumentDetail();

  return (
    <div className="flex-1 min-h-0 px-6 lg:px-10 py-6 flex flex-col">
      <TocTab entityType="document" entityId={document.id} />
    </div>
  );
}
