// app/documents/[id]/text-pages/page.tsx
'use client';

import DocumentTextPagesTab from '@/components/admin/documents/DocumentTextPagesTab';
import { useDocumentDetail } from '@/components/admin/documents/DocumentDetailContext';

export default function DocumentTextPagesPage() {
  const { document, companyId } = useDocumentDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
      <DocumentTextPagesTab documentId={document.id} companyId={companyId} />
    </div>
  );
}
