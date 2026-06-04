// app/templates/[id]/text-pages/page.tsx
'use client';

import Link from 'next/link';
import TemplateTextPagesTab from '@/components/admin/templates/TemplateTextPagesTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateTextPagesPage() {
  const { template, companyId } = useTemplateDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
      <p className="text-xs text-faint mb-4">
        Edit text page content and settings here. To reorder, add, or remove pages use the{' '}
        <Link href={`/templates/${template.id}/pages`} className="text-teal hover:underline">Pages</Link> tab.
      </p>
      <TemplateTextPagesTab templateId={template.id} companyId={companyId} />
    </div>
  );
}
