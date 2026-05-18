// app/templates/[id]/contents/page.tsx
'use client';

import TocTab from '@/components/admin/shared/TocTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateContentsPage() {
  const { template } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <TocTab entityType="template" entityId={template.id} />
    </div>
  );
}
