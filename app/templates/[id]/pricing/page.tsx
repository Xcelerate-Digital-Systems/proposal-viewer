// app/templates/[id]/pricing/page.tsx
'use client';

import TemplatePricingTab from '@/components/admin/templates/TemplatePricingTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplatePricingPage() {
  const { template, companyId } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 px-6 lg:px-10 py-6 flex flex-col">
      <TemplatePricingTab templateId={template.id} companyId={companyId} />
    </div>
  );
}
