// components/admin/documents/DocumentTextPagesTab.tsx
'use client';

import TextPagesTabEditor from '@/components/admin/shared/TextPagesTabEditor';

interface DocumentTextPagesTabProps {
  documentId: string;
  companyId: string;
}

export default function DocumentTextPagesTab({ documentId, companyId }: DocumentTextPagesTabProps) {
  return (
    <TextPagesTabEditor
      apiBase="/api/documents/pages"
      entityKey="document_id"
      entityId={documentId}
      companyId={companyId}
    />
  );
}