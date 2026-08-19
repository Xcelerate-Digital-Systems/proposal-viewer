// app/templates/[id]/cover/page.tsx
'use client';

import TemplateCoverEditor from '@/components/admin/templates/TemplateCoverEditor';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateCoverPage() {
  const { template, refetch } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <TemplateCoverEditor template={template} onSave={refetch} />
    </div>
  );
}
