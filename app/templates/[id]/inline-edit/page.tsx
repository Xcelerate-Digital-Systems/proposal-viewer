// app/templates/[id]/inline-edit/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminTemplateViewer from '@/components/admin/templates/AdminTemplateViewer';

export default function TemplateInlineEditPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout collapseSidebar>
      {() => <TemplateInlineEditContent templateId={params.id} />}
    </AdminLayout>
  );
}

function TemplateInlineEditContent({ templateId }: { templateId: string }) {
  const router = useRouter();
  return (
    <AdminTemplateViewer
      templateId={templateId}
      onExit={() => router.push(`/templates/${templateId}/pages`)}
    />
  );
}
