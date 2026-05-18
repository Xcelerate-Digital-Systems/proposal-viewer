// app/templates/[id]/packages/page.tsx
'use client';

import TemplatePackagesTab from '@/components/admin/templates/TemplatePackagesTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplatePackagesPage() {
  const { template, companyId } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6 flex flex-col">
      <TemplatePackagesTab templateId={template.id} companyId={companyId} />
    </div>
  );
}
