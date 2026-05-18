// components/admin/templates/TemplatePackagesTab.tsx
'use client';

import PackagesSection from '@/components/admin/builder-sections/PackagesSection';

interface TemplatePackagesTabProps {
  templateId: string;
  companyId: string;
}

export default function TemplatePackagesTab({ templateId, companyId }: TemplatePackagesTabProps) {
  return (
    <PackagesSection
      apiBase="/api/templates/pages"
      entityKey="template_id"
      entityId={templateId}
      companyId={companyId}
      extraPostFields={{ company_id: companyId }}
    />
  );
}
