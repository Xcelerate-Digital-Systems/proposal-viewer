// components/admin/documents/DocumentTextPagesTab.tsx
'use client';

import TextPagesSection from '@/components/admin/builder-sections/TextPagesSection';

interface DocumentTextPagesTabProps {
  documentId: string;
  companyId: string;
}

export default function DocumentTextPagesTab({ documentId, companyId }: DocumentTextPagesTabProps) {
  return (
    <TextPagesSection
      apiBase="/api/documents/pages"
      entityKey="document_id"
      entityId={documentId}
      companyId={companyId}
    />
  );
}
