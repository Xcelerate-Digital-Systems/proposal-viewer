// components/admin/templates/TemplateTextPagesTab.tsx
'use client';

import TextPagesSection from '@/components/admin/builder-sections/TextPagesSection';

interface TemplateTextPagesTabProps {
  templateId: string;
  companyId: string;
}

export default function TemplateTextPagesTab({ templateId, companyId }: TemplateTextPagesTabProps) {
  return (
    <TextPagesSection
      apiBase="/api/templates/pages"
      entityKey="template_id"
      entityId={templateId}
      companyId={companyId}
      extraPostFields={{ company_id: companyId }}
    />
  );
}
