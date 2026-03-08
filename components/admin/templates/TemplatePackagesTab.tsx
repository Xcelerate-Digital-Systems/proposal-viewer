// components/admin/templates/TemplatePackagesTab.tsx
'use client';

import PackagesTabEditor from '@/components/admin/shared/PackagesTabEditor';

interface TemplatePackagesTabProps {
  templateId: string;
  companyId: string;
}

export default function TemplatePackagesTab({ templateId, companyId }: TemplatePackagesTabProps) {
  return (
    <PackagesTabEditor
      apiBase="/api/templates/pages"
      entityKey="template_id"
      entityId={templateId}
      companyId={companyId}
      extraPostFields={{ company_id: companyId }}
    />
  );
}