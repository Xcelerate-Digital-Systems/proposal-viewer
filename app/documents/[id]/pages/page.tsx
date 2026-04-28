// app/documents/[id]/pages/page.tsx
'use client';

import { PageEditor } from '@/components/admin/page-editor';
import { useDocumentDetail } from '@/components/admin/documents/DocumentDetailContext';

export default function DocumentPagesPage() {
  const { document, refetch } = useDocumentDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6">
      <PageEditor
        proposalId={document.id}
        filePath={document.file_path}
        initialPageNames={document.page_names || []}
        onSave={() => refetch()}
        tableName="documents"
      />
    </div>
  );
}
