// app/templates/[id]/text-pages/page.tsx
'use client';

import TemplateTextPagesTab from '@/components/admin/templates/TemplateTextPagesTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateTextPagesPage() {
  const { template, companyId } = useTemplateDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
      <TemplateTextPagesTab templateId={template.id} companyId={companyId} />
    </div>
  );
}
