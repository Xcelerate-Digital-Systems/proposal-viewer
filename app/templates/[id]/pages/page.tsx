// app/templates/[id]/pages/page.tsx
'use client';

import PageEditor from '@/components/admin/page-editor/PageEditor';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplatePagesPage() {
  const { template, refetch } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-10 py-6">
      <PageEditor
        proposalId={template.id}
        tableName="templates"
        onSave={refetch}
      />
    </div>
  );
}
