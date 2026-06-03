// app/documents/[id]/details/page.tsx
'use client';

import EditDetailsPanel from '@/components/admin/shared/EditDetailsPanel';
import { useDocumentDetail } from '@/components/admin/documents/DocumentDetailContext';

export default function DocumentDetailsPage() {
  const { document: doc, refetch } = useDocumentDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6">
      <EditDetailsPanel
        type="document"
        id={doc.id}
        initialValues={{
          title: doc.title,
          description: doc.description,
        }}
        onSave={refetch}
      />
    </div>
  );
}
