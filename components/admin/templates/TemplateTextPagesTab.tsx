// components/admin/templates/TemplateTextPagesTab.tsx
'use client';

import TextPagesTabEditor from '@/components/admin/shared/TextPagesTabEditor';

interface TemplateTextPagesTabProps {
  templateId: string;
  companyId: string;
}

export default function TemplateTextPagesTab({ templateId, companyId }: TemplateTextPagesTabProps) {
  return (
    <TextPagesTabEditor
      apiBase="/api/templates/pages"
      entityKey="template_id"
      entityId={templateId}
      companyId={companyId}
      extraPostFields={{ company_id: companyId }}
    />
  );
}