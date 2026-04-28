// app/templates/[id]/contents/page.tsx
'use client';

import TocTab from '@/components/admin/shared/TocTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateContentsPage() {
  const { template } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 px-6 lg:px-10 py-6 flex flex-col">
      <TocTab entityType="template" entityId={template.id} />
    </div>
  );
}
